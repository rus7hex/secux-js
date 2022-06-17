# `transport-webusb`

> SecuX Hardware Wallet webUSB/USB API for communication layer

## Usage

```ts
import { SecuxWebUSB } from "@secux/transport-webusb";


const device = await SecuxWebUSB.Create(
    () => console.log("connected"),
    () => console.log("disconnected")
);

await device.Connect();

...

await device.Disconnect();
```