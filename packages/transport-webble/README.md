# `@secux/transport-webble`

> Secux Hardware Wallet webBLE API for communication layer

## Usage

```ts
import { SecuxWebBLE } from "@secux/transport-webble";

const device = await SecuxWebBLE.Create(
    () => console.log("connected"),
    () => console.log("disconnected")
);

await device.Connect();

const otp = prompt("Please enter otp showing on SecuX Hardware Wallet");
await device.SendOTP(otp);

...

await device.Disconnect();
```
