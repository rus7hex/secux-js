[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lerna.js.org/)
[![view on npm](https://badgen.net/npm/v/@secux/app-btc)](https://www.npmjs.com/package/@secux/app-btc)
[![npm module downloads](https://badgen.net/npm/dt/@secux/app-btc)](https://www.npmjs.org/package/@secux/app-btc)

# `@secux/app-btc`

> SecuX Hardware Wallet BTC API

## Usage

```ts
import { SecuxBTC, ScriptType } from "@secux/app-btc";
```

First, create instance of ITransport.
- [Web Usb](https://www.npmjs.com/package/@secux/transport-webusb)
- [Web Bluetooth](https://www.npmjs.com/package/@secux/transport-webble)
- [React Native Bluetooth](https://www.npmjs.com/package/@secux/transport-reactnative)

<br/>

## Examples
1. Get address by purpose and script type.
   - tweaked key-spend only address (default script: P2TR)
        ```ts
        const path = "m/86'/0'/0'/0/0";
        const address = await device.getAddress(path);

        /*

        // transfer data to hardware wallet by custom transport layer.
        const data = SecuxBTC.prepareAddress(path);
        const response = await device.Exchange(data);
        const address = SecuxBTC.resolveAddress(response, path);

        */
        ```
   - native segwit address (default script: P2WPKH)
        ```ts
        const address = await device.getAddress("m/84'/0'/0'/0/0");
        ```
   - segwit address (default script: P2SH_P2WPKH)
        ```ts
        const address = await device.getAddress("m/49'/0'/0'/0/0");
        ```
   - legacy address (default script: P2PKH)
        ```ts
        const address = await device.getAddress("m/44'/0'/0'/0/0");
        ```


2. For bitcoin ecosystem, you can use specific cointype by the coin.
    - native segwit address for `dogecoin`
        ```ts
        const address = await device.getAddress("m/84'/3'/0'/0/0");
        ```
    - segwit address for `litecoin`
        ```ts
        const address = await device.getAddress("m/49'/2'/0'/0/0");
        ```
    - legacy address for `bitcoincash`
        ```ts
        const address = await device.getAddress("m/44'/145'/0'/0/0");
        ```
    - you can refer to [here](https://github.com/satoshilabs/slips/blob/master/slip-0044.md) for cointype.


3. Sign transaction.
```ts
const inputs = [
    {
        hash: "0b062e71e165fba9634d9fb1b5ba703e774bf374815b1f5a617c8d1e7d43dc01",
        vout: 0,
        // optional, give raw transaction data for checking
        txHex: "0100000001b103a004f672080ceae8277e83c296b5ac090ae78157979211da3e2d41399d1b010000006b483045022100f19d88e6a17789dc399ff2a93b4516bb44af32928d4986138f1a4f7f37ab277b022046fc14c958bc8aa97fea1d2fbf80982534cf51634d46c4d5178e5ca6698bca07012102f8667cfb5b80c3695e3f0c9078589cb04e8d15e71bdae89ebf24b82f9d663d5cffffffff02bc020000000000001976a9145c592f40134c6179a1ce5b06b28d5c2ae443113188ac00040000000000001976a9146d65ced4ef49e23cdbb4be9d510b38e5be28e10688ac00000000",
        satoshis: 700,
        path: "m/44'/0'/0'/0/0",
        // for custom transport layer, each utxo need publickey.
        // publickey: "03aaeb52dd7494c361049de67cc680e83ebcbbbdbeb13637d92cd845f70308af5e"
    },
    {
        hash: "07ad0a13e501d292bc8b9e16a3a8b62f99f77ab9e37ea8d3b8453984a2899984",
        vout: 0,
        // optional, you can use specific script for each input
        // script: ScriptType.P2SH_P2PKH,
        satoshis: 6000,
        path: "m/49'/0'/0'/0/0",
        // for custom transport layer, each utxo need publickey.
        // publickey: "039b3b694b8fc5b5e07fb069c783cac754f5d38c3e08bed1960e31fdb1dda35c24"
    },
    {
        hash: "8686aee2b9dcf559798b9718ed26ca92e0c64bef11c433e576cae658678c497d",
        vout: 1,
        satoshis: 1083,
        path: "m/84'/0'/0'/1/0",
        // for custom transport layer, each utxo need publickey.
        // publickey: "03025324888e429ab8e3dbaf1f7802648b9cd01e9b418485c5fa4c1b9b5700e1a6"
    }
];

const to = {
    address: "bc1qs0k3ekx0z7a7yuq3lse7prw373s8cr8lhxvccd",
    satoshis: 1500
};

const utxo = {
    path: "m/44'/0'/0'/0/0",
    satoshis: 6100,
    // for custom transport layer, each utxo need publickey.
    // publickey: "03aaeb52dd7494c361049de67cc680e83ebcbbbdbeb13637d92cd845f70308af5e"
};

const obj = await device.sign(
    inputs, 
    { to, utxo },
    // given feeRate to estimate fee, and fee will be changed if greater than estimated value or less than minimal fee.
    // { feeRate: 1 } 
);

const rspList = [];
for (const cmd of obj.multi_command) {
    const rsp = await transport.Exchange(cmd);
    rspList.push(rsp);
}
const signed = SecuxBTC.resolveTransaction(rspList, obj);

/*

// transfer data to hardware wallet by custom transport layer.
const { commands, rawTx } = SecuxBTC.prepareSign(inputs, { to, utxo });
const rspList = [];
for (const cmd of commands) {
    const rsp = await transport.Exchange(cmd);
    rspList.push(rsp);
}
const signed = SecuxBTC.resloveTransaction(rspList, {
    rawTx, 
    publickeys: inputs.map(x => x.publickey),
});

*/
```

4. Derive address from xpub, ypub, or zpub.
    - tweaked key-spend only address (default script: P2TR)
        ```ts
        // m/86'/0'/0'
        const xpub = "xpub6BgBgsespWvERF3LHQu6CnqdvfEvtMcQjYrcRzx53QJjSxarj2afYWcLteoGVky7D3UKDP9QyrLprQ3VCECoY49yfdDEHGCtMMj92pReUsQ";
        // m/86'/0'/0'/0/0
        const address = SecuxBTC.deriveAddress(xpub, 0, 0,
        {
            // you can use specific coin
            // coin: CoinType.BITCOIN,
            script: ScriptType.P2TR
        });
        ```
    - native segwit address (default script: P2WPKH)
        ```ts
        // m/84'/0'/0'
        const zpub = "zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs";
        // m/84'/0'/0'/0/0
        const address = SecuxBTC.deriveAddress(zpub, 0, 0,
        {
            // you can use specific coin and script
            // coin: CoinType.DOGECOIN,
            // script: ScriptType.P2WPKH
        });
        ```
    - segwit address (default script: P2SH_P2WPKH)
        ```ts
        // m/49'/0'/1'
        const ypub = "ypub6Ww3ibxVfGzLtJR4F9SRBicspAfvmvw54yern9Q6qZWFC9T6FYA34K57La5Sgs8pXuyvpDfEHX5KNZRiZRukUWaVPyL4NxA69sEAqdoV8ve";
        // m/49'/0'/1'/0/1
        const address = SecuxBTC.deriveAddress(ypub, 0, 1);
        ```
    - legacy address (default script: P2PKH)
        ```ts
        // m/44'/0'/0'
        const xpub = "xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj";
        // m/44'/0'/0'/1/0
        const address = SecuxBTC.deriveAddress(xpub, 1, 0);
        ```

5. Estimate transaction size
```ts
const size = SecuxBTC.getVirtualSize(
    // your inputs
    [
        ScriptType.P2PKH,
        ScriptType.P2SH_P2WPKH,
        ScriptType.P2SH_P2WPKH,
        ScriptType.P2WPKH,
        ...
    ],
    // your outputs
    [
        ScriptType.P2PKH,
        ScriptType.P2PKH,
        ScriptType.P2WPKH,
        ...
    ]
);
```


# API Reference
ERROR, Cannot find class.
<br/>
<br/>
<a name="ScriptType"></a>

## ScriptType : <code>enum</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| P2PKH | <code>number</code> | 0 |
| P2WPKH | <code>number</code> | 1 |
| P2SH_P2PKH | <code>number</code> | 2 |
| P2SH_P2WPKH | <code>number</code> | 3 |
| P2TR | <code>number</code> | 4 |

<br/>
<a name="CoinType"></a>

## CoinType : <code>enum</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| BITCOIN | <code>number</code> | 0 |
| TESTNET | <code>number</code> | 1 |
| REGTEST | <code>number</code> | 2 |
| LITECOIN | <code>number</code> | 3 |
| BITCOINCASH | <code>number</code> | 4 |
| GROESTL | <code>number</code> | 5 |
| DIGIBYTE | <code>number</code> | 6 |
| DASH | <code>number</code> | 7 |
| DOGECOIN | <code>number</code> | 8 |

<br/>
<a name="PathObject"></a>

## PathObject : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| coin | [<code>CoinType</code>](#CoinType) | enum |
| script | [<code>ScriptType</code>](#ScriptType) | enum |

<br/>
<a name="AddressOption"></a>

## AddressOption : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| [coin] | [<code>CoinType</code>](#CoinType) | enum |
| [script] | [<code>ScriptType</code>](#ScriptType) | enum |

<br/>
<a name="txInput"></a>

## txInput : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | BIP32 path refer to utxo |
| publickey | <code>string</code> \| <code>Buffer</code> | scep256k1 publickey from `path` |
| hash | <code>string</code> | referenced transaction hash |
| vout | <code>number</code> | referenced transaction output index |
| satoshis | <code>number</code> \| <code>string</code> | referenced transaction output amount |
| [script] | [<code>ScriptType</code>](#ScriptType) | script type related to `path` |
| [txHex] | <code>string</code> | referenced raw transaction for validation |

<br/>
<a name="txOutput"></a>

## txOutput : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| to | [<code>txOutputAddress</code>](#txOutputAddress) \| [<code>txOutputScriptExtened</code>](#txOutputScriptExtened) | receiving address information |
| [utxo] | [<code>txOutputScriptExtened</code>](#txOutputScriptExtened) | changes |

<br/>
<a name="txOutputAddress"></a>

## txOutputAddress : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| address | <code>string</code> | receiving address |
| satoshis | <code>number</code> \| <code>string</code> | receiving amount |

<br/>
<a name="txOutputScriptExtened"></a>

## txOutputScriptExtened : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | BIP32 path |
| publickey | <code>string</code> \| <code>Buffer</code> | scep256k1 publickey from `path` |
| satoshis | <code>number</code> \| <code>string</code> | amount |
| [script] | [<code>ScriptType</code>](#ScriptType) | script type related to `path` |

<br/>
<a name="SignOption"></a>

## SignOption : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| [coin] | [<code>CoinType</code>](#CoinType) | check cointype for each input |
| [feeRate] | <code>number</code> | calculate optimal transaction fee and replace it |
| [isRBF] | <code>boolean</code> | make Replace-by-Fee transaction |

<br/>
<a name="prepared"></a>

## prepared : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| commandData | [<code>communicationData</code>](#communicationData) | data for sending to device |
| rawTx | <code>string</code> | unsigned raw transaction |

<br/>
<a name="TransactionObject"></a>

## TransactionObject : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| rawTx | <code>string</code> | unsigned raw transaction |
| publickeys | <code>Array.&lt;(string\|Buffer)&gt;</code> | publickey correspond to each input |
| [coin] | [<code>CoinType</code>](#CoinType) |  |

<br/>

* * *

&copy; 2018-21 SecuX Technology Inc.

authors:<br/>
andersonwu@secuxtech.com