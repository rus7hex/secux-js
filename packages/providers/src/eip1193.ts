/*!
Copyright 2023 SecuX Technology Inc
Copyright Wu Tsung-Yu

Licensed under the Apache License, Version 2.0 (the License);
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an AS IS BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/


import { RequestArguments } from "@json-rpc-tools/types";
import { IJsonRpcConnection, JsonRpcPayload } from "@json-rpc-tools/utils";
import { EthereumProvider } from "eip1193-provider";
import { BigNumber } from "bignumber.js";
const secp256k1 = require('secp256k1/elliptic');
import { keccak256 } from "js-sha3";
import { ITransport } from "@secux/transport";
import { DeviceType } from "@secux/transport/lib/interface";
import { SecuxWebBLE } from "@secux/transport-webble";
import { SecuxWebUSB } from "@secux/transport-webusb";
import { SecuxWebHID } from "@secux/transport-webhid";
import { SecuxWalletHandler } from "@secux/transport-handler";
import { SecuxETH } from "@secux/app-eth";
import { ow_address } from "@secux/app-eth/lib/interface";
import { Logger, owTool } from "@secux/utility";
import { getBuffer } from "@secux/utility/lib/communication";
import { SecuxTransactionTool } from "@secux/protocol-transaction";
import { getPriorityFee } from "./fee";
import "./http";
import ow from "ow";
const logger = Logger?.child({ id: "provider" });


export class EIP1193Provider extends EthereumProvider {
    #transport?: ITransport;
    #path = '';
    #address = '';
    #chainId = '';
    #accountIndex = 0;
    #useEIP1559 = false;


    constructor(connection: string | IJsonRpcConnection, transport?: ITransport) {
        super(connection);

        this.#transport = transport;
    }

    async connect(connection?: string | IJsonRpcConnection): Promise<void> {
        await super.connect(connection);

        if (!this.#transport) return;
        await this.setAccount(this.#accountIndex);
    }

    async disconnect(): Promise<void> {
        await super.disconnect();
        await this.#transport?.Disconnect();
    }

    async request(request: RequestArguments<any>, context?: any): Promise<any> {
        if (!this.connection.connected) await this.connect();

        switch (request.method) {
            case "eth_requestAccounts":
                if (this.#transport instanceof SecuxWalletHandler) return [this.#address];
                if (this.#transport) await this.#transport.Disconnect();

                this.#transport = await this.#findDevice(request.params?.[0]);
                await connectDevice(this.#transport);
                await this.setAccount(this.#accountIndex);
                return [this.#address];

            case "eth_accounts":
                return !!this.#address ? [this.#address] : [];

            case "eth_signTransaction": {
                const params = request.params?.[0];
                if (!params) throw Error("missing value for required argument 0");
                return await this.#signTransaction(params);
            }

            case "eth_sendTransaction": {
                const params = request.params?.[0];
                if (!params) throw Error("missing value for required argument 0");
                await this.prepareData(params);
                const tx = await this.#signTransaction(params);
                return await super.request({ method: "eth_sendRawTransaction", params: [tx] });
            }

            case "eth_sign": {
                const address = request.params?.[0];
                let hash = request.params?.[1];
                this.#checkAddress(address);
                if (!hash) throw Error("missing value for required argument 1");

                if (!Buffer.isBuffer(hash)) {
                    ow(hash, ow.string.matches(/^0x[0-9A-F-a-f]{64}/));
                    hash = Buffer.from(hash.slice(2), "hex");
                }
                if (hash.length !== 32) throw Error("Invalid parameters: must provide a 32 bytes hash.");

                const data = SecuxTransactionTool.signTransaction(this.#path, hash);
                const response = await this.#transport!.Exchange(getBuffer(data));
                // Metamask does not apply EIP-155
                const signature = SecuxETH.resolveSignatureEIP155(response);
                return `0x${signature}`;
            }

            case "personal_sign": {
                let address = request.params?.[1], message = request.params?.[0];
                try {
                    this.#checkAddress(address);
                } catch (error) {
                    address = request.params?.[0];
                    message = request.params?.[1];
                    this.#checkAddress(address);
                    if (!message) throw Error("missing value for required argument 1");
                }
                if (!message) throw Error("missing value for required argument 0");

                const data = SecuxETH.prepareSignMessage(this.#path, message);
                const response = await this.#transport!.Exchange(getBuffer(data));
                // Metamask does not apply EIP-155
                const signature = SecuxETH.resolveSignatureEIP155(response);
                return `0x${signature}`;
            }

            case "personal_ecRecover": {
                let message = request.params?.[0], signature = request.params?.[1];
                if (!message) throw Error("missing value for required argument 0");
                if (!signature) throw Error("missing value for required argument 1");

                if (message.startsWith("0x")) {
                    message = Buffer.from(message.replace(/^0x/, ''), "hex").toString("utf8");
                }
                const buf = Buffer.from(`\x19Ethereum Signed Message:\n${message.length}${message}`);
                const hash = Buffer.from(keccak256.update(buf).digest());

                const sig = Buffer.from(signature.replace(/^0x/, ''), "hex");
                const recid = sig.readUint8(64) - 27;
                const publickey = Buffer.from(secp256k1.ecdsaRecover(sig.slice(0, 64), recid, hash));
                return SecuxETH.addressConvert(publickey);
            }

            case "eth_signTypedData":
            case "eth_signTypedData_v3":
            case "eth_signTypedData_v4": {
                let address = request.params?.[0], msgParams = request.params?.[1];
                try {
                    this.#checkAddress(address);
                } catch (error) {
                    address = request.params?.[1];
                    msgParams = request.params?.[0];
                    this.#checkAddress(address);
                    if (!msgParams) throw Error("missing value for required argument 0");
                }
                if (!msgParams) throw Error("missing value for required argument 1");

                if (typeof msgParams !== "string") msgParams = JSON.stringify(msgParams);
                const { signature } = await this.#transport!.sign(this.#path, msgParams);
                return signature;
            }
        }

        return await super.request(request, context);
    }

    protected async open(connection: string | IJsonRpcConnection = this.connection): Promise<void> {
        if (this.connection === connection && this.connection.connected) return;
        if (this.connection.connected) this.close();

        this.connection = this.setConnection(connection);
        await this.connection.open();
        this.connection.on("payload", (payload: JsonRpcPayload) => this.onPayload(payload));
        this.connection.on("close", () => this.events.emit("disconnect"));
        this.connection.on("error", () => this.events.emit("error"));

        const chainId = await this.request({ method: "eth_chainId" });
        this.events.emit("connect", { chainId });

        if (!!this.#chainId && this.#chainId !== chainId) {
            this.events.emit("chainChanged", { chainId });
        }
        this.#chainId = chainId;

        this.#useEIP1559 = await this.#is_EIP1559_Supported();
        logger?.debug(`useEIP1559: ${this.#useEIP1559}`);
    }


    get chainId() {
        return this.#chainId;
    }

    async setAccount(index: number): Promise<string> {
        this.#accountIndex = index;
        this.#path = `m/44'/60'/${this.#accountIndex}'/0/0`;
        if (!this.#transport) throw Error("wallet not available");

        const address = await this.#transport.getAddress(this.#path);

        if (this.#address && this.#address.toLowerCase() !== address.toLowerCase()) {
            this.events.emit("accountsChanged", [address]);
        }
        this.#address = address;

        return address;
    }

    async prepareData(params: any) {
        if (!params.value) {
            params.value = "0x0";
        }
        else {
            params.value = `0x${BigNumber(params.value).toString(16)}`;
        }

        const { from, to, value, data } = params;
        const gas = await this.request(
            {
                method: "eth_estimateGas",
                params: [{
                    from: from || this.#address,
                    to,
                    value,
                    data
                }]
            }
        );
        params.gas = `0x${BigNumber(params.gas || 0).toString(16)}`;
        if (BigNumber(gas).gt(params.gas)) {
            params.gas = gas;
        }

        const gasPrice = BigNumber(params.gasPrice);
        if (!gasPrice.isFinite() || gasPrice.lte(0)) {
            params.gasPrice = await this.request(
                {
                    method: "eth_gasPrice"
                }
            );
        }
        else {
            params.gasPrice = `0x${gasPrice.toString(16)}`;
        }

        // estimate EIP-1559 priority fee if not provided
        if (this.#useEIP1559 && !params.priorityFee) {
            const priority = (await getPriorityFee(this, [50]))[0];
            if (BigNumber(priority).gt(0)) {
                params.priorityFee = priority;
            }
            else {
                params.priorityFee = "0x1";
            }

            logger?.debug(`estimate priority fee: ${BigNumber(priority).div(1e9).toFixed(2)} Gwei`);
        }

        if (!params.nonce) {
            params.nonce = await this.request(
                {
                    method: "eth_getTransactionCount",
                    params: [this.#address, "latest"]
                }
            );
        }
        else {
            params.nonce = `0x${BigNumber(params.nonce).toString(16)}`;
        }

        // clean data field
        for (const key of Object.keys(params)) {
            if (!params[key]) delete params[key];
        }
    }

    async #findDevice(type: string): Promise<ITransport> {
        const _disconnected = async () => {
            this.#address = '';
            await this.disconnect();
        };

        switch (type) {
            case "usb":
                return await SecuxWebUSB.Create(undefined, _disconnected);

            case "hid":
                return await SecuxWebHID.Create(undefined, _disconnected);

            default:
                return await SecuxWebBLE.Create(undefined, _disconnected, Object.values(DeviceType));
        }
    }

    async #signTransaction(params: any): Promise<string> {
        ow(params, ow.object.partialShape({
            from: ow.any(ow.undefined, ow_address),
            to: ow_address,
            gas: ow.any(ow.undefined, ow.number.positive, owTool.prefixedhexString, owTool.numberString),
            gasPrice: ow.any(ow.undefined, ow.number.positive, owTool.prefixedhexString, owTool.numberString),
            priorityFee: ow.any(ow.undefined, ow.number.positive, owTool.prefixedhexString, owTool.numberString),
            value: ow.any(ow.undefined, ow.number.not.negative, owTool.prefixedhexString, owTool.numberString),
            data: ow.any(ow.undefined, owTool.prefixedhexString, ow.string.equals("0x")),
            nonce: ow.any(ow.undefined, ow.number.not.negative, owTool.prefixedhexString, owTool.numberString),
        }));
        if (!this.#address) throw Error("wallet not available");
        if (params.from && params.from.toLowerCase() !== this.#address.toLowerCase()) {
            throw Error(`unknown wallet address ${params.from}, expect ${this.#address}`);
        }

        const tx = this.#useEIP1559 ?
            {
                ...params,
                gasLimit: params.gas,
                chainId: this.#chainId,
                maxFeePerGas: `0x${BigNumber(params.gasPrice!).plus(params.priorityFee!).toString(16)}`,
                maxPriorityFeePerGas: params.priorityFee!,
            }
            :
            {
                ...params,
                gasLimit: params.gas,
                chainId: this.#chainId,
            };
        logger?.debug(tx);

        const { raw_tx } = await this.#transport!.sign(this.#path, tx);
        return raw_tx;
    }

    async #is_EIP1559_Supported(): Promise<boolean> {
        const forceEIP155 = [
            "0x38", // BNB Smart Chain Mainnet
            "0x61", // BNB Smart Chain Testnet
        ];
        if (forceEIP155.includes(this.#chainId)) return false;

        try {
            await getPriorityFee(this, [0]);
        }
        catch (error) {
            return false;
        }

        return true;
    }

    #checkAddress(address: string) {
        try {
            ow(address, ow_address);
        } catch (error) {
            throw Error("Invalid parameters: must provide an Ethereum address.");
        }

        if (address && address.toLowerCase() !== this.#address.toLowerCase()) {
            throw Error(`unknown wallet address ${address}`);
        }
    }
}


async function connectDevice(transport: ITransport) {
    await transport.Connect();

    if (transport instanceof SecuxWebBLE && transport.DeviceType === DeviceType.crypto) {
        let otp = '';

        do {
            otp = prompt("Please enter otp showing on your SecuX") || '';
            try {
                const authenticated = await transport.SendOTP(otp);
                if (authenticated) return;
            }
            catch (error) {
                // do nothing
            }
        } while (otp);

        throw Error("Connection caneclled");
    }
}