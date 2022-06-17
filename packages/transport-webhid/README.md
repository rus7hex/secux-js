# `@secux/transport-webhid`

> SecuX Hardware Wallet webHID API for communication layer

## Usage

```ts
import { SecuxWebHID } from "@secux/transport-webhid";


const device = await SecuxWebHID.Create(
    () => console.log("connected"),
    () => console.log("disconnected")
);

await device.Connect();

...

await device.Disconnect();
```