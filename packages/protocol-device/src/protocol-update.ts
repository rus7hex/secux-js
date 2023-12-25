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
import { ITransportNordic, SEINFO, StatusCallback } from "./interface";
import * as se from "./se-update";
import { Logger } from "@secux/utility";
import {
    communicationData, getBuffer, ow_communicationData, Send, StatusCode, toAPDUResponse, TransportStatusError, wrapResult
} from "@secux/utility/lib/communication";
import ow from "ow";
const logger = Logger?.child({ id: "protocol" });


export const BOOTLOADER = Object.freeze({ vendorId: 0x1915, productId: 0x4296 });

export class SecuxUpdate {
    /**
     * Get SecuX device security chip state
     * @param {ITransport} trans 
     * @returns {SEINFO}
     */
    static async getSEModeState(trans: ITransport): Promise<SEINFO> {
        const buf = this.prepareGetSEMode();
        const rsp = await trans.Exchange(getBuffer(buf));
        return this.resolveGetSEMode(rsp);
    }

    static prepareGetSEMode(): communicationData {
        return Send(0x80, 0x10);
    }

    static resolveGetSEMode(response: communicationData): SEINFO {
        ow(response, ow_communicationData);

        const rsp = toAPDUResponse(getBuffer(response));
        if (rsp.status !== StatusCode.SUCCESS) throw new TransportStatusError(rsp.status);

        return wrapResult({
            mode: rsp.data.readUint8(0),
            state: rsp.data.readUint8(1)
        });
    }

    /**
     * SecuX device change to MCU bootloader mode
     * @param {ITransport} trans 
     * @returns {boolean}
     */
    static async EnterMCUBootloader(trans: ITransport): Promise<boolean> {
        const buf = this.prepareEnterMCUBootloader();
        const rsp = await trans.Exchange(getBuffer(buf));
        const isSuccess = this.resolveStatus(rsp);

        if (isSuccess) {
            // wait for device change mode
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        return isSuccess;
    }

    static prepareEnterMCUBootloader(): communicationData {
        return Send(0x70, 0x80);
    }

    static resolveStatus(response: communicationData): boolean {
        const rsp = toAPDUResponse(getBuffer(response));
        return rsp.status === StatusCode.SUCCESS;
    }

    /**
     * SecuX device change to SE bootloader mode
     * @param {ITransport} trans
     * @returns {boolean}
     */
    static async EnterSEBootloader(trans: ITransport): Promise<boolean> {
        const buf = this.prepareEnterSEBootloader();
        const rsp = await trans.Exchange(getBuffer(buf));
        const isSuccess = this.resolveStatus(rsp);

        if (isSuccess) {
            // wait for device change mode
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        return isSuccess;
    }

    static prepareEnterSEBootloader(): communicationData {
        return Send(0x80, 0x78);
    }

    /**
     * Update MCU firmware
     */
    static async UpdateMCU(data: Uint8Array, use_usb: boolean, callback?: StatusCallback) {
        if (use_usb) {
            await updateInWorker(data, callback);
            return;
        }

        // Web Bluetooth API cannot use in service worker.
        const { NordicBLE } = require("./nordic-ble");
        const device = await NordicBLE.Create();
        await device.Connect();

        await SecuxUpdate.UpdateMCUWithDevice(device, data, callback);
    }

    static async UpdateMCUWithDevice(device: ITransportNordic, data: Uint8Array, callback?: StatusCallback) {
        const { beginUpdate, proceed } = require("./dfu");

        window?.addEventListener?.("beforeunload", alertExit);
        try {
            const empty = Buffer.alloc(0);
            let cmd = beginUpdate(data, false, device.packetSize);
            while (cmd.data.length !== 0) {
                let rsp = empty;
                if (cmd.needResponse) {
                    await device.Write(cmd.data);
                    rsp = await device.Read();
                }
                else {
                    await device.WritePacket(cmd.data);
                }

                callback?.call(undefined, cmd.progress);

                await new Promise(_ => setTimeout(_, 1));
                cmd = proceed(rsp);
            }

            callback?.call(undefined, 100);
        }
        finally {
            window?.removeEventListener?.("beforeunload", alertExit);
        }
    }

    /**
     * Update SE firmware
     * @param {ITransport} trans 
     * @param {object} firmware
     */
    static async UpdateSE(trans: ITransport, data: any, callback?: StatusCallback) {
        let cmd = se.beginUpdate(data);
        while (cmd.data.length > 0) {
            const rsp = await trans.Exchange(getBuffer(cmd.data));
            if (!SecuxUpdate.resolveStatus(rsp)) throw Error("update failed");

            callback?.call(undefined, cmd.progress);

            cmd = se.proceed();
        }
    }
}

async function updateInWorker(data: Uint8Array, callback?: StatusCallback) {
    const { spawn, Thread, Worker } = require("threads");
    const worker = await spawn(new Worker('worker.js'));
    worker.logger().subscribe((msg: string) => logger?.debug(msg));

    if (callback) worker.status().subscribe((progress: number) => callback(progress));

    // Request permission to access the device.
    const device = await navigator.usb.requestDevice({ filters: [BOOTLOADER] });
    await worker.connectUSB(device.serialNumber);

    window.addEventListener("beforeunload", alertExit);

    try {
        await worker.update(data);
        await Thread.terminate(worker);
    }
    finally {
        window.removeEventListener("beforeunload", alertExit);
    }
}

function alertExit(this: Window, ev: BeforeUnloadEvent) {
    ev = ev || this.event;

    // For IE and Firefox prior to version 4
    if (ev) ev.returnValue = 'Sure?';

    // For Safari
    return 'Sure?';
};