# `@secux/app-dgb`

> SecuX Hardware Wallet DGB API

## Usage

```ts
import { SecuxDGB } from "@secux/app-dgb";
```

First, create instance of ITransport.
- [Web Usb](https://www.npmjs.com/package/@secux/transport-webusb)
- [Web Bluetooth](https://www.npmjs.com/package/@secux/transport-webble)
- [React Native Bluetooth](https://www.npmjs.com/package/@secux/transport-reactnative)

<br/>

## Examples
1. Get address by BIP32 path.
    - native segwit address (default script: P2WPKH)
        ```ts
        const path = "m/84'/20'/0'/0/0";
        const address = await deivce.getAddress(path);

        /*

        // transfer data to hardware wallet by custom transport layer.
        const data = SecuxDGB.prepareAddress(path);
        const response = await device.Exchange(data);
        const address = SecuxDGB.resolveAddress(response, path);

        */
        ```
    - segwit address (default script: P2SH_P2WPKH)
        ```ts
        const address = await deivce.getAddress("m/49'/20'/0'/0/0");
        ```
    - legacy address (default script: P2PKH)
        ```ts
        const address = await deivce.getAddress("m/44'/20'/0'/0/0");
        ```

2. Sign transaction (native segwit has not supported yet).
```ts
const inputs = [
    {
        hash: "4632c6b99925ebae5b806f5956d2d730415fe0c8c7edbfa2edea22e99a8f9f56",
        vout: 0,
        satoshis: 100000000,
        path: "m/44'/20'/0'/0/0",
        // for custom transport layer, each utxo need publickey.
        // publickey: "02d07f1bcfdc3f25b23236bf46477527b26bd383fc6c03d7050105e16325c0b401"
    },
    {
        hash: "18638cd984ab631ad7dafc5a701bec3ffa9b26bed5855eee4598d53a2ecad870",
        vout: 0,
        satoshis: 50000000,
        path: "m/49'/20'/0'/0/0",
        // for custom transport layer, each utxo need publickey.
        // publickey: "03c117cf3c09cd66bd826082ecf4fb2e322b8d97ec4bfbdc380415ca9fe0c554bc"
    }
];

const to = {
    address: "D7TwNix9ziu8k16gAcqkyKWvXhXg7tkdAC",
    satoshis: 70000000
};

const utxo = {
    path: `m/44'/20'/0'/0/11`,
    satoshis: 77777777,
    // for custom transport layer, each utxo need publickey.
    // publickey: "03efc5266e1979ada343a2271c83d1f0e9c19682bb9ddaabe10f028021781a7c01"
}

const { raw_tx } = await device.sign(inputs, { to, utxo });

/*

// transfer data to hardware wallet by custom transport layer.
const { commandData, rawTx } = SecuxDGB.prepareSign(inputs, { to, utxo });
const response = await device.Exchange(commandData);
const signed = SecuxDGB.resloveTransaction(response, rawTx, inputs.map(x => x.publickey));

*/
```

## API doc
Similar to [@secux/app-btc](https://www.npmjs.com/package/@secux/app-btc).