import { RequestArguments } from "@json-rpc-tools/types";
import { IJsonRpcConnection, JsonRpcPayload } from "@json-rpc-tools/utils";
import { EthereumProvider } from "eip1193-provider";
import { ITransport } from "@secux/transport";
import { DeviceType } from "@secux/transport/lib/interface";
import { SecuxWebBLE } from "@secux/transport-webble";
import { SecuxWebUSB } from "@secux/transport-webusb";
import { SecuxWebHID } from "@secux/transport-webhid";
import "@secux/app-eth";


export class EIP1193Provider extends EthereumProvider {
    #transport?: ITransport;
    #path = '';
    #address = '';
    #chainId = '';


    constructor(connection: string | IJsonRpcConnection, transport?: ITransport) {
        super(connection);

        this.#transport = transport;
    }

    async connect(connection?: string | IJsonRpcConnection): Promise<void> {
        await super.connect(connection);

        if (!this.#transport) return;
        if (!this.#address) await connectDevice(this.#transport);
        await this.setAccount(0);
    }

    async request(request: RequestArguments<any>, context?: any): Promise<any> {
        if (!this.connection.connected) await this.connect();

        switch (request.method) {
            case "eth_requestAccounts":
                if (this.#transport) await this.#transport.Disconnect();

                this.#transport = await this.#findDevice(request.params?.[0]);
                await connectDevice(this.#transport);
                await this.setAccount(0);
                return [this.#address];

            case "eth_accounts":
                return !!this.#address ? [this.#address] : [];
        }

        return super.request(request, context);
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
    }

    protected async close(): Promise<void> {
        await super.close();
        await this.#transport?.Disconnect();
    }


    async setAccount(index: number) {
        this.#path = `m/44'/60'/${index}'/0/0`;
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
            } catch (error) {
                // do nothing
            }
        } while (otp);

        throw Error("Connection caneclled");
    }
}