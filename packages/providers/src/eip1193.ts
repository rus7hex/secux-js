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
import { ITransport } from "@secux/transport";
import { DeviceType } from "@secux/transport/lib/interface";
import { SecuxWebBLE } from "@secux/transport-webble";
import { SecuxWebUSB } from "@secux/transport-webusb";
import { SecuxWebHID } from "@secux/transport-webhid";
import { SecuxETH } from "@secux/app-eth";
import { ow_address } from "@secux/app-eth/lib/interface";
import { Logger, owTool } from "@secux/utility";
import { getBuffer } from "@secux/utility/lib/communication";
import { SecuxTransactionTool } from "@secux/protocol-transaction";
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
        if (!this.#address) await connectDevice(this.#transport);
        await this.setAccount(this.#accountIndex);
    }

    async request(request: RequestArguments<any>, context?: any): Promise<any> {
        if (!this.connection.connected) await this.connect();

        switch (request.method) {
            case "eth_requestAccounts":
                if (this.#transport) await this.#transport.Disconnect();

                this.#transport = await this.#findDevice(request.params?.[0]);
                await connectDevice(this.#transport);
                await this.setAccount(this.#accountIndex);
                return [this.#address];

            case "eth_accounts":
                return !!this.#address ? [this.#address] : [];

            case "eth_signTransaction": {
                const params = request.params?.[0];
                if (!params) throw "missing value for required argument 0";
                return await this.#signTransaction(params);
            }

            case "eth_sendTransaction": {
                const params = request.params?.[0];
                if (!params) throw "missing value for required argument 0";
                const tx = await this.#signTransaction(params);
                return await super.request({ method: "eth_sendRawTransaction", params: [tx] });
            }

            case "eth_sign": {
                const address = request.params?.[0];
                let hash = request.params?.[1];
                this.#checkAddress(address);
                if (!hash) throw "missing value for required argument 1";

                if (!Buffer.isBuffer(hash)) {
                    ow(hash, ow.string.matches(/^0x[0-9A-F-a-f]{64}/));
                    hash = Buffer.from(hash.slice(2), "hex");
                }
                if (hash.length !== 32) throw "Invalid parameters: must provide a 32 bytes hash.";

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
                    if (!message) throw "missing value for required argument 1";
                }
                if (!message) throw "missing value for required argument 0";

                const data = SecuxETH.prepareSignMessage(this.#path, message);
                const response = await this.#transport!.Exchange(getBuffer(data));
                // Metamask does not apply EIP-155
                const signature = SecuxETH.resolveSignatureEIP155(response);
                return `0x${signature}`;
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
                    if (!msgParams) throw "missing value for required argument 0";
                }
                if (!msgParams) throw "missing value for required argument 1";

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

        if (!this.#chainId && this.#chainId !== chainId) {
            this.events.emit("chainChanged", { chainId });
        }
        this.#chainId = chainId;

        this.#useEIP1559 = await this.#is_EIP1559_Supported();
        logger?.debug(`useEIP1559: ${this.#useEIP1559}`);
    }

    protected async close(): Promise<void> {
        await super.close();
        await this.#transport?.Disconnect();
    }


    async setAccount(index: number) {
        this.#accountIndex = index;
        this.#path = `m/44'/60'/${this.#accountIndex}'/0/0`;
        const address = await this.#transport!.getAddress(this.#path);

        if (!this.#address && this.#address !== address) {
            this.events.emit("accountsChanged", [address]);
        }
        this.#address = address;
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
            gas: ow.any(ow.undefined, owTool.prefixedhexString),
            gasPrice: ow.any(ow.undefined, owTool.prefixedhexString),
            value: ow.any(ow.undefined, owTool.prefixedhexString),
            data: ow.any(ow.undefined, owTool.prefixedhexString),
            nonce: ow.any(ow.undefined, owTool.prefixedhexString),
        }));
        if (!this.#address) throw "wallet not available";
        if (params.from && params.from !== this.#address) throw `unknown wallet address ${params.from}`;

        await this.#fetchData(params);
        const tx = this.#useEIP1559 ?
            {
                ...params,
                gasLimit: params.gas,
                chainId: this.#chainId,
                // default priority fee: 1 Gwei
                maxFeePerGas: `0x${BigNumber(params.gasPrice!).plus("0x3b9aca00").toString(16)}`,
                maxPriorityFeePerGas: "0x3b9aca00",
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

    async #fetchData(params: any) {
        if (!params.value) params.value = "0x0";

        if (!params.gas) {
            const { from, to, data } = params;
            params.gas = await this.request(
                {
                    method: "eth_estimateGas",
                    params: [{ from, to, data }]
                }
            );
        }

        if (!params.gasPrice) {
            params.gasPrice = await this.request(
                {
                    method: "eth_gasPrice"
                }
            );
        }

        if (!params.nonce) {
            params.nonce = await this.request(
                {
                    method: "eth_getTransactionCount",
                    params: [this.#address, "latest"]
                }
            );
        }
    }

    async #is_EIP1559_Supported(): Promise<boolean> {
        try {
            await this.request({ method: "eth_feeHistory", params: ["0x1", "latest", [0]] });
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
            throw "Invalid parameters: must provide an Ethereum address.";
        }

        if (address && address !== this.#address) throw `unknown wallet address ${address}`;
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