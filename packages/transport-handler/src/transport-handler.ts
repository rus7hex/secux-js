/*!
Copyright 2022 SecuX Technology Inc
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


import { ITransport } from "@secux/transport";
import { TransportConfig } from "@secux/transport/lib/interface";
import { base64String, communicationData, getBuffer, ow_communicationData, to_L1_APDU } from "@secux/utility/lib/communication";
import { EventEmitter } from "events";
import ow from "ow";


interface WalletEvents {
    "connect": () => void,
    "disconnect": () => void,
    "write": (data: base64String) => void,
    "read": () => void
}

export class SecuxWalletHandler extends ITransport {
    #packetize: boolean;
    #handler = new EventEmitter();


    constructor(config?: { protocol: number, packetize: boolean } & TransportConfig) {
        super({ timeout: config?.timeout });

        this.autoApplyL1 = config?.protocol === ITransport.PROTOCOLv2;
        this.#packetize = !!config?.packetize;
    }

    on<T extends keyof WalletEvents>(event: T, listener: WalletEvents[T]) {
        this.#handler.on(event, listener);
    }

    emit(event: string | symbol, ...args: any[]): boolean {
        return this.#handler.emit(event, ...args);
    }

    async Connect() {
        this.#handler.emit("connect");
    }

    async Disconnect() {
        this.#handler.emit("disconnect");
    }

    async Write(data: Buffer) {
        if (!this.#packetize) return;

        this.#handler.emit("write", data.toString("base64"));
    }

    get Exchange() {
        return this.#Exchange;
    }

    get Read() {
        return this.#Read;
    }

    get ReceiveData() {
        return this.#ReceiveData;
    }

    #Exchange = async (data: Buffer): Promise<Buffer> => {
        const task = super.Exchange(data);

        if (!this.#packetize) {
            let L1 = data;
            if (this.version === ITransport.PROTOCOLv2 && this.autoApplyL1 && data[0] !== 0xf8) {
                L1 = getBuffer(to_L1_APDU(data));
            }

            this.#handler.emit("write", data.toString("base64"));
        }

        return await task;
    }

    #Read = async (): Promise<Buffer> => {
        const task = super.Read();

        this.#handler.emit("read");

        return await task;
    }

    #ReceiveData = (data: communicationData) => {
        ow(data, ow_communicationData);
        super.ReceiveData(getBuffer(data));
    };
}