[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lerna.js.org/)
[![view on npm](https://badgen.net/npm/v/@secux/app-eth)](https://www.npmjs.com/package/@secux/app-eth)
[![npm module downloads](https://badgen.net/npm/dt/@secux/app-eth)](https://www.npmjs.org/package/@secux/app-eth)

# `@secux/app-eth`

> SecuX Hardware Wallet ETH API

## Usage

```ts
import { SecuxETH } from "@secux/app-eth";
```

First, create instance of ITransport.
- [Web Usb](https://www.npmjs.com/package/@secux/transport-webusb)
- [Web Bluetooth](https://www.npmjs.com/package/@secux/transport-webble)
- [React Native Bluetooth](https://www.npmjs.com/package/@secux/transport-reactnative)

<br/>

## Examples
1. Get address derived by given BIP44 path.
```ts
const address = await device.getAddress("m/44'/60'/0'/0/0");

/*

// transfer data to hardware wallet by custom transport layer.
const buffer = SecuxETH.prepareAddress("m/44'/60'/0'/0/0");
const response = await device.Exchange(buffer);
const address = SecuxETH.resolveAddress(response);

*/
```

2. Sign legacy transaction (EIP-155).
```ts
const { raw_tx, signature } = await device.sign(
    "m/44'/60'/0'/0/0",
    {
        nonce: 0,
        to: "0xD080156885651fADbD6df14145051b934660a748",
        value: 1e10,
        chainId: 1,
        gasPrice: 1e6,
        gasLimit: 25000
    }
)

/*

// transfer data to hardware wallet by custom transport layer.
const { commandData, rawTx } = SecuxETH.prepareSignEIP155(
    "m/44'/60'/0'/0/0",
    {
        nonce: 0,
        to: "0xD080156885651fADbD6df14145051b934660a748",
        value: 1e10,
        chainId: 1,
        gasPrice: 1e6,
        gasLimit: 25000
    }
);
const response = await device.Exchange(commandData);
const rawTx = SecuxETH.resolveTransaction(response, rawTx);

*/
```

3. Sign EIP-1559 transaction.
```ts
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

4. Sign transaction with Smart Contract (ERC-20).
```ts
const { raw_tx, signature } = await device.sign(
    "m/44'/60'/0'/0/0",
    {
        nonce: 0,
        to: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
        value: 0,
        data: "0xa9059cbb000000000000000000000000d080156885651fadbd6df14145051b934660a7410000000000000000000000000000000000000000000000000000000000989680",
        chainId: 1,
        gasPrice: 1e6,
        gasLimit: 25000
    }
);

/*

// alternative usage
const { commandData, rawTx } = SecuxETH.ERC20.prepareTransfer(
    "m/44'/60'/0'/0/0",
    {
        nonce: 0,
        to: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
        value: 0,
        chainId: 1,
        gasPrice: 1e6,
        gasLimit: 25000
    },
    {
        toAddress: "0xD080156885651fADbD6df14145051b934660a748",
        amount: `0x${1e18.toString(16)}`
    }
);
const response = await device.Exchange(commandData);
const rawTx = SecuxETH.resolve(response, rawTx);

*/
```

4. Sign Message transaction.
```ts
const { signature } = await device.sign("m/44'/60'/0'/0/0", msg);

// given chainId, return EIP-155 applied signature
// const { signature } = await device.sign("m/44'/60'/0'/0/0", msg, 1);

/*

// transfer data to hardware wallet by custom transport layer.
const buffer = SecuxETH.prepareSignMessage("m/44'/60'/0'/0/0", msg);
const response = await device.Exchange(buffer);
const signature = SecuxETH.resolveSignatureEIP155(response);

*/
```

5. Sign TypeData transaction (EIP-712).
```ts
const { signature } = await device.sign("m/44'/60'/0'/0/0", JSON.stringify(typedData));

// given chainId, return EIP-155 applied signature
// const { signature } = await device.sign("m/44'/60'/0'/0/0", JSON.stringify(typedData), 1);

/*

// transfer data to hardware wallet by custom transport layer.
const buffer = SecuxETH.prepareSignTypedData("m/44'/60'/0'/0/0", msg);
const response = await device.Exchange(buffer);
// given chainId, return EIP-155 applied signature
const signature = SecuxETH.resolveSignatureEIP155(response, 1);

*/
```

6. Sign transaction with WalletConnect.
```ts
const { raw_tx, signature } = await device.sign(
    "m/44'/60'/0'/0/0",
    {
        nonce: 0,
        to: "0xD080156885651fADbD6df14145051b934660a748",
        value: 0,
        data: "0x7ff36ab5000000000000000000000000000000000000000000000000302bf3f82d406d120000000000000000000000000000000000000000000000000000000000000080000000000000000000000000d080156885651fadbd6df14145051b934660a7480000000000000000000000000000000000000000000000000000000060b613630000000000000000000000000000000000000000000000000000000000000003000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c0000000000000000000000007130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c000000000000000000000000e9e7cea3dedca5984780bafc599bd69add087d56",
        chainId: 56,
        gasPrice: 1e6,
        gasLimit: 25000
    },
    true
);

/*

// transfer data to hardware wallet by custom transport layer.
const { commandData, rawTx } = SecuxETH.prepareSignWalletConnectTransaction(
    "m/44'/60'/0'/0/0",
    {
        nonce: 0,
        to: "0xD080156885651fADbD6df14145051b934660a748",
        value: 0,
        data: "0x7ff36ab5000000000000000000000000000000000000000000000000302bf3f82d406d120000000000000000000000000000000000000000000000000000000000000080000000000000000000000000d080156885651fadbd6df14145051b934660a7480000000000000000000000000000000000000000000000000000000060b613630000000000000000000000000000000000000000000000000000000000000003000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c0000000000000000000000007130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c000000000000000000000000e9e7cea3dedca5984780bafc599bd69add087d56",
        chainId: 56,
        gasPrice: 1e6,
        gasLimit: 25000
    }
);
const response = await device.Exchange(commandData);
const rawTx = SecuxETH.resolveTransaction(response, rawTx);

*/
```

<br />

## Note
1. Value of chainId (same as EIP-155):
   - Ethereum Mainnet: 1
   - Binance Smart Chain Mainnet: 56
   - Polygon Network: 137
   - goto https://chainlist.org/ for your specific chain.

<br />

# API Reference
ETH package for SecuX device

**Kind**: global class  

* [SecuxETH](#SecuxETH)
    * [.prepareAddress](#SecuxETH.prepareAddress) ⇒ <code>communicationData</code>
    * [.addressConvert(publickey)](#SecuxETH.addressConvert) ⇒ <code>string</code>
    * [.resolveAddress(response)](#SecuxETH.resolveAddress) ⇒ <code>string</code>
    * [.preparePublickey(path)](#SecuxETH.preparePublickey) ⇒ <code>communicationData</code>
    * [.resolvePublickey(response)](#SecuxETH.resolvePublickey) ⇒ <code>string</code>
    * [.prepareXPublickey(path)](#SecuxETH.prepareXPublickey) ⇒ <code>communicationData</code>
    * [.resolveXPublickey(response, path)](#SecuxETH.resolveXPublickey) ⇒ <code>string</code>
    * [.prepareSignSerialized(path, serialized)](#SecuxETH.prepareSignSerialized) ⇒ <code>communicationData</code>
    * [.resolveSignature(response)](#SecuxETH.resolveSignature) ⇒ <code>string</code>
    * [.resolveTransaction(response, serialized)](#SecuxETH.resolveTransaction) ⇒ <code>string</code>
    * [.prepareSignEIP155(path, content)](#SecuxETH.prepareSignEIP155) ⇒ [<code>prepared</code>](#prepared)
    * [.resolveSignatureEIP155(response, [chainId])](#SecuxETH.resolveSignatureEIP155) ⇒ <code>string</code>
    * [.prepareSignEIP1559(path, content)](#SecuxETH.prepareSignEIP1559) ⇒ [<code>prepared</code>](#prepared)
    * [.prepareSignMessage(path, message)](#SecuxETH.prepareSignMessage) ⇒ <code>communicationData</code>
    * [.prepareSignTypedData(path, data)](#SecuxETH.prepareSignTypedData) ⇒ <code>communicationData</code>
    * [.prepareSignWalletConnectTransaction(path, content)](#SecuxETH.prepareSignWalletConnectTransaction) ⇒ [<code>prepared</code>](#prepared)

<br/>
<a name="SecuxETH.prepareAddress"></a>

### **SecuxETH.prepareAddress ⇒ <code>communicationData</code>**
*Prepare data for address generation.*

**Returns**: <code>communicationData</code> - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | m/44'/60'/... |

<br/>
<a name="SecuxETH.addressConvert"></a>

### **SecuxETH.addressConvert(publickey) ⇒ <code>string</code>**
*Convert publickey to ETH address.*

**Returns**: <code>string</code> - EIP55 address  

| Param | Type | Description |
| --- | --- | --- |
| publickey | <code>string</code> \| <code>Buffer</code> | secp256k1 publickey |

<br/>
<a name="SecuxETH.resolveAddress"></a>

### **SecuxETH.resolveAddress(response) ⇒ <code>string</code>**
*Resolve address from response data.*

**Returns**: <code>string</code> - EIP55 address  

| Param | Type | Description |
| --- | --- | --- |
| response | <code>communicationData</code> | data from device |

<br/>
<a name="SecuxETH.preparePublickey"></a>

### **SecuxETH.preparePublickey(path) ⇒ <code>communicationData</code>**
*Prepare data for secp256k1 publickey.*

**Returns**: <code>communicationData</code> - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | m/44'/60'/... |

<br/>
<a name="SecuxETH.resolvePublickey"></a>

### **SecuxETH.resolvePublickey(response) ⇒ <code>string</code>**
*Resolve secp256k1 publickey from response data.*

**Returns**: <code>string</code> - secp256k1 publickey (hex string)  

| Param | Type | Description |
| --- | --- | --- |
| response | <code>communicationData</code> | data from device |

<br/>
<a name="SecuxETH.prepareXPublickey"></a>

### **SecuxETH.prepareXPublickey(path) ⇒ <code>communicationData</code>**
*Prepare data for xpub generation.*

**Returns**: <code>communicationData</code> - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | m/44'/60'/... |

<br/>
<a name="SecuxETH.resolveXPublickey"></a>

### **SecuxETH.resolveXPublickey(response, path) ⇒ <code>string</code>**
*Generate xpub with response data.*

**Returns**: <code>string</code> - xpub  

| Param | Type | Description |
| --- | --- | --- |
| response | <code>communicationData</code> | data from device |
| path | <code>string</code> | m/44'/60'/... |

<br/>
<a name="SecuxETH.prepareSignSerialized"></a>

### **SecuxETH.prepareSignSerialized(path, serialized) ⇒ <code>communicationData</code>**
*Convert unsigned transaction to command data.*

**Returns**: <code>communicationData</code> - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | m/44'/60'/... |
| serialized | <code>communicationData</code> | unsigned transaction |

<br/>
<a name="SecuxETH.resolveSignature"></a>

### **SecuxETH.resolveSignature(response) ⇒ <code>string</code>**
*Reslove signature from response data.*

**Returns**: <code>string</code> - signature (hex string)  

| Param | Type | Description |
| --- | --- | --- |
| response | <code>communicationData</code> | data from device |

<br/>
<a name="SecuxETH.resolveTransaction"></a>

### **SecuxETH.resolveTransaction(response, serialized) ⇒ <code>string</code>**
*Serialize transaction wtih signature for broadcasting.*

**Returns**: <code>string</code> - signed raw transaction  

| Param | Type | Description |
| --- | --- | --- |
| response | <code>communicationData</code> | data from device |
| serialized | <code>communicationData</code> | unsigned transaction |

<br/>
<a name="SecuxETH.prepareSignEIP155"></a>

### **SecuxETH.prepareSignEIP155(path, content) ⇒ [<code>prepared</code>](#prepared)**
*Prepare data for signing.*

**Returns**: [<code>prepared</code>](#prepared) - prepared object  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | m/44'/60'/... |
| content | [<code>tx155</code>](#tx155) | EIP-155 transaction object |

<br/>
<a name="SecuxETH.resolveSignatureEIP155"></a>

### **SecuxETH.resolveSignatureEIP155(response, [chainId]) ⇒ <code>string</code>**
*Reslove signature and follow ethereum signature standard.*

**Returns**: <code>string</code> - signature (hex string)  

| Param | Type | Description |
| --- | --- | --- |
| response | <code>communicationData</code> | data from device |
| [chainId] | <code>number</code> | if give a chainId, the signature will be EIP-155 applied |

<br/>
<a name="SecuxETH.prepareSignEIP1559"></a>

### **SecuxETH.prepareSignEIP1559(path, content) ⇒ [<code>prepared</code>](#prepared)**
*Prepare data for signing (London Hard Fork).*

**Returns**: [<code>prepared</code>](#prepared) - prepared object  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | m/44'/60'/... |
| content | [<code>tx1559</code>](#tx1559) | EIP-1559 transaction object |

<br/>
<a name="SecuxETH.prepareSignMessage"></a>

### **SecuxETH.prepareSignMessage(path, message) ⇒ <code>communicationData</code>**
*Prepare data for signing.*

**Returns**: <code>communicationData</code> - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | m/44'/60'/... |
| message | <code>string</code> |  |

<br/>
<a name="SecuxETH.prepareSignTypedData"></a>

### **SecuxETH.prepareSignTypedData(path, data) ⇒ <code>communicationData</code>**
*Prepare data for signing.*

**Returns**: <code>communicationData</code> - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | m/44'/60'/... |
| data | <code>JsonString</code> | EIP712 |

<br/>
<a name="SecuxETH.prepareSignWalletConnectTransaction"></a>

### **SecuxETH.prepareSignWalletConnectTransaction(path, content) ⇒ [<code>prepared</code>](#prepared)**
*Prepare data for signing using WalletConnect protocol.*

**Returns**: [<code>prepared</code>](#prepared) - prepared object  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | m/44'/60'/... |
| content | [<code>tx155</code>](#tx155) \| [<code>tx1559</code>](#tx1559) | transaction object |

<br/>

<br/>
<a name="tx155"></a>

## tx155
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| chainId | <code>number</code> | network for ethereum ecosystem |
| to | <code>string</code> | receiving address |
| value | <code>number</code> \| <code>string</code> | sending amount |
| nonce | <code>number</code> \| <code>string</code> |  |
| gasPrice | <code>number</code> \| <code>string</code> |  |
| gasLimit | <code>number</code> \| <code>string</code> |  |
| [data] | <code>string</code> |  |

<br/>
<a name="prepared"></a>

## prepared
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| commandData | <code>communicationData</code> | data for sending to device |
| serialized | <code>communicationData</code> | unsigned transaction |

<br/>
<a name="tx1559"></a>

## tx1559
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| chainId | <code>number</code> | network for ethereum ecosystem |
| to | <code>string</code> | receiving address |
| value | <code>number</code> \| <code>string</code> | sending amount |
| nonce | <code>number</code> \| <code>string</code> |  |
| maxPriorityFeePerGas | <code>number</code> \| <code>string</code> |  |
| maxFeePerGas | <code>number</code> \| <code>string</code> |  |
| gasLimit | <code>number</code> \| <code>string</code> |  |
| [content.accessList] | <code>Array.&lt;any&gt;</code> |  |
| [data] | <code>string</code> |  |

<br/>

* * *

&copy; 2018-21 SecuX Technology Inc.

authors:<br/>
andersonwu@secuxtech.com