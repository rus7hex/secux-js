# `@secux/transport-handler`

> SecuX Hardware Wallet javascript handler for web and application

## Usage

```js
import { SecuxWalletHandler } from '@secux/transport-handler';

const handler = new SecuxWalletHandler();
handler.on("connect", () => console.log("connected"));
handler.on("disconnect", () => console.log("disconnected"));
handler.on("write", (data) => {
    // send buffer to SecuX wallet
    const buffer = Buffer.from(data, "base64");
});

// read buffer from SecuX wallet and call back
const received = readFromDevice();
handler.ReceiveData(received);
```