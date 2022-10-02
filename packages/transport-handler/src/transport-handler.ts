/*!
Copyright 2022 SecuX Technology Inc
Copyright Chen Wei-En
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
import ow from "ow";


type CommunicationEvent = (data: base64String) => void;
type HandlerConfig = {
    protocol: number,
    packetize: boolean
} & TransportConfig;

export class SecuxWalletHandler extends ITransport {
    #OnSendData: CommunicationEvent;
    #packetize: boolean;


    constructor(
        onSendData: (data: base64String) => void,
        config?: HandlerConfig
    ) {
        super({ timeout: config?.timeout });

        this.#OnSendData = onSendData;
        this.autoApplyL1 = config?.protocol === ITransport.PROTOCOLv2;
        this.#packetize = !!config?.packetize;
    }

    async Write(data: Buffer) {
        if (!this.#packetize) return;

        this.#OnSendData(data.toString("base64"));
    }

    get Exchange() {
        return this.#Exchange;
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

            this.#OnSendData(data.toString("base64"));
        }

        return await task;
    }

    #ReceiveData = (data: communicationData) => {
        ow(data, ow_communicationData);
        super.ReceiveData(getBuffer(data));
    };
}