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


import { communicationData, Send, toCommunicationData, wrapResult } from "@secux/utility/lib/communication";

type Exchange = {
    data: communicationData,
    progress: number
}

type FirmwareData = {
    blockId: number,
    data: string,
    mac: string
}

const jobs: Array<Exchange> = [];

export function beginUpdate(data: any): Exchange {
    jobs.length = 0;

    if (typeof data === "string") {
        const buf = Buffer.from(data, "base64");
        const fw = preloadSE(buf.toString('utf8'));
        createJob(fw, jobs);
    }
    else{
        createJob(data, jobs);
    }

    return wrapResult(jobs.shift()!);
}

const emptyResponse: Exchange = {
    data: toCommunicationData(Buffer.alloc(0)),
    progress: 0
};
export function proceed(): Exchange {
    const job = jobs.shift() ?? emptyResponse;
    return wrapResult(job);
}


function createJob(data: any, queue: Array<Exchange>) {
    const { anthmthrl, encsmk, firmware } = data;

    const blockTotalBuffer = Buffer.alloc(4);
    blockTotalBuffer.writeUInt32LE(firmware.length, 0);

    // check update FW
    queue.push(
        {
            data: Send(0x70, 0x60, 0x00, 0x00,
                Buffer.concat([
                    Buffer.from(TrimHexString(anthmthrl), "hex"),
                    Buffer.from(TrimHexString(encsmk), "hex"),
                    blockTotalBuffer
                ])
            ),
            progress: 0
        }
    );

    const total = (firmware as Array<FirmwareData>)
        .reduce((a, b) => a + b.data.length + b.mac.length, 0);

    let current = 0;
    // update FW
    for (const { id, data, mac } of firmware) {
        if ((id || id === 0) && data && mac) {
            const blockIdBuffer = Buffer.alloc(4);
            blockIdBuffer.writeUInt32LE(id, 0);
            current += data.length + mac.length;

            queue.push({
                data: Send(0x70, 0x61, 0x00, 0x00,
                    Buffer.concat([
                        blockIdBuffer,
                        Buffer.from(TrimHexString(data), "hex"),
                        Buffer.from(TrimHexString(mac), "hex")
                    ])
                ),
                progress: Math.round(current / total * 10000) / 100
            });
        }
    }
}

function preloadSE(data: string) {
    const strArray = data.split('\n');
    let obj = {
        anthmthrl: strArray[0],
        encsmk: strArray[1],
        firmware: [] as { id: number, data: string, mac: string }[]
    };

    for (let i = 2; i < strArray.length - 1; i += 3) {
        if (strArray[i][0] !== '#') continue;

        obj.firmware.push({
            id: parseInt(strArray[i].slice(1), 10),
            data: strArray[i + 1],
            mac: strArray[i + 2]
        });
    }

    return obj;
}

function TrimHexString(str: string): string {
    if (str.startsWith("0x")) str = str.substring(2);
    str = str.length % 2 === 0 ? str : "0" + str;

    return str;
}
