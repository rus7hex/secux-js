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


const SERVICE_UUID = 0xFE59;
const CONTROL_UUID = "8ec90001-f315-4f60-9fb8-838830daea50";
const PACKET_UUID = "8ec90002-f315-4f60-9fb8-838830daea50";
const callback = () => { };


export class NordicBLE extends ITransport {
    #device: BluetoothDevice;
    #control?: BluetoothRemoteGATTCharacteristic;
    #packet?: BluetoothRemoteGATTCharacteristic;
    #OnConnected: Function;
    #OnDisconnected: Function;

    constructor(device: BluetoothDevice, OnConnected: Function = callback, OnDisconnected: Function = callback) {
        super();

        this.packetSize = 64;
        this.#device = device;
        this.#OnConnected = OnConnected;
        this.#OnDisconnected = OnDisconnected;
    }

    static async Create(OnConnected: Function = callback, OnDisconnected: Function = callback): Promise<NordicBLE> {
        const device = await navigator.bluetooth.requestDevice({ filters: [{ services: [SERVICE_UUID] }] });
        return new NordicBLE(device, OnConnected, OnDisconnected);
    }

    async Connect() {
        const ValueChangedId = 'characteristicvaluechanged';
        const handleNotifications = (event: Event) => {
            //@ts-ignore
            const value = event.target?.value;
            if (value.buffer) this.ReceiveData(Buffer.from(value.buffer));
        }

        this.#device.addEventListener('gattserverdisconnected', () => {
            this.#control!.removeEventListener(ValueChangedId, handleNotifications)
            this.#control = undefined;
            this.#packet = undefined;

            this.#OnDisconnected();
        });

        const server = await this.#device.gatt!.connect();

        this.#OnConnected();
        const service = await server.getPrimaryService(SERVICE_UUID);

        this.#control = await service.getCharacteristic(CONTROL_UUID);
        this.#packet = await service.getCharacteristic(PACKET_UUID);

        await this.#control.startNotifications();
        this.#control.addEventListener(ValueChangedId, handleNotifications);
    }

    async Disconnect() {
        this.#device.gatt!.disconnect();
        this.#control = undefined;
        this.#packet = undefined;
    }

    async Write(data: Buffer) {
        await this.#control!.writeValue(data);
    }

    async WritePacket(data: Buffer) {
        await this.#packet!.writeValue(data);
    }
}