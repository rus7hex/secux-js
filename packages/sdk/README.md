[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lerna.js.org/)
[![view on npm](https://badgen.net/npm/v/@secux/js-sdk)](https://www.npmjs.com/package/@secux/js-sdk)
[![npm module downloads](https://badgen.net/npm/dt/@secux/js-sdk)](https://www.npmjs.org/package/@secux/js-sdk)

# `@secux/js-sdk`

> A JavaScript library for SecuX hardware wallet

## Installation
```
npm install @secux/js-sdk
```

## Getting Started
If you are using javascript projecct, here are packages for connecting to SecuX harware wallet:
- [Web Usb](https://www.npmjs.com/package/@secux/transport-webusb)
- [Web Bluetooth](https://www.npmjs.com/package/@secux/transport-webble)
- [React Native Bluetooth](https://www.npmjs.com/package/@secux/transport-reactnative)

If not, please refer to our develop portal for integrating with other programming languages. (comming soon)

## Examples (using usb)
Example for connecting SecuX hardware wallet by usb:
```ts
import { SecuxWebUSB } from "@secux/transport-webusb";
require("secux-sdk");


const device = await SecuxWebUSB.Create(
    () => console.log("connected"),
    () => console.log("disconnected")
);
await device.Connect();
```

- Get address by BIP32 path.
    ```ts
    // BTC native segwit address
    const address = await device.getAddress("m/84'/0'/0'/0/0");
    ```

    ```ts
    // ETH address
    const address = await device.getAddress("m/44'/60'/0'/0/0");
    ```
- Get extended publickey by BIP32 path. (support xpub, ypub, zpub)
    ```ts
    const xpub = await device.getXPublickey("m/84'/0'/0'/0/0");
    ```
- Signing.
    ```ts
    // for ETH EIP-1559
    const { raw_tx, signature } = await device.sign(
        "m/44'/60'/0'/0/0",
        {
            nonce: 0,
            to: "0xD080156885651fADbD6df14145051b934660a748",
            value: 1e10,
            chainId: 1,
            maxPriorityFeePerGas: 1e4,
            maxFeePerGas: 1e6,
            gasLimit: 25000
        }
    );
    ```

## Modules API Reference
Please refer to related blockchain api for use.
- [ADA (Cardano)](https://www.npmjs.com/package/@secux/app-ada)
- [BNB (Binance)](https://www.npmjs.org/package/@secux/app-bnb)
- [BTC (Bitcoin)](https://www.npmjs.org/package/@secux/app-btc)
- [ETH (Ethereum)](https://www.npmjs.org/package/@secux/app-eth)
- [TRX (Tron)](https://www.npmjs.org/package/@secux/app-trx)
- [XLM (Stellar)](https://www.npmjs.org/package/@secux/app-xlm)
- [XRP (Ripple)](https://www.npmjs.org/package/@secux/app-xrp)
- [SecuxTransactionTool](https://www.npmjs.org/package/@secux/protocol-transaction)
- [SecuxDevice](https://www.npmjs.org/package/@secux/protocol-device)

* * *

&copy; 2018-22 SecuX Technology Inc.

authors:<br/>
andersonwu@secuxtech.com