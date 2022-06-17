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
import { SecuxWebUSB } from "@secux/transport-webusb";
import { expose } from "threads";
import { Observable, Subject } from "threads/observable";
import { BOOTLOADER } from "./protocol-update";
import { beginUpdate, proceed } from "./dfu";
import { getBuffer } from "@secux/utility/lib/communication";


let _status: Subject<number> = new Subject();
let _logger: Subject<string> = new Subject();
let transport: ITransport;
expose({
    async connectUSB(serialNumber: string) {
        const devices = await navigator.usb.getDevices();

        const device = devices.find(x =>
            x.vendorId === BOOTLOADER.vendorId &&
            x.productId === BOOTLOADER.productId &&
            x.serialNumber === serialNumber
        );

        transport = new SecuxWebUSB(
            device!,
            () => _logger.next("device connected."),
            () => _logger.next("device disconnected.")
        );
        await transport.Connect();
    },

    async update(data: Buffer) {
        const empty = Buffer.allocUnsafe(0);
        let cmd = beginUpdate(data, true);
        while (cmd.data.length !== 0) {
            await transport.Write(getBuffer(cmd.data));

            let rsp = empty;
            if (cmd.needResponse) {
                rsp = await transport.Read();
            }

            if (cmd.progress > 0) _status.next(cmd.progress);
            await new Promise(resolve => setTimeout(resolve, 1));

            cmd = proceed(rsp);
        }
    },

    status() {
        return Observable.from(_status);
    },

    logger() {
        return Observable.from(_logger);
    }
});
