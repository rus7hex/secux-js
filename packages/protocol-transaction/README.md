[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lerna.js.org/)
[![view on npm](https://badgen.net/npm/v/@secux/protocol-transaction)](https://www.npmjs.com/package/@secux/protocol-transaction)
[![npm module downloads](https://badgen.net/npm/dt/@secux/protocol-transaction)](https://www.npmjs.org/package/@secux/protocol-transaction)

# `@secux/protocol-transaction`

> SecuX Hardware Wallet transcation related protocol API

## Usage

```ts
import { EllipticCurve, SecuxTransactionTool } from "@secux/protocol-transaction";
```

First, create instance of ITransport
- [Web Usb](https://www.npmjs.com/package/@secux/transport-webusb)
- [Web Bluetooth](https://www.npmjs.com/package/@secux/transport-webble)
- [React Native Bluetooth](https://www.npmjs.com/package/@secux/transport-reactnative)

<br/>

## Examples
1. Query publickey from SecuX Hardware Wallet
```ts
const data = SecuxTransactionTool.getPublickey("m/44'/0'/0'/0/0", EllipticCurve.SECP256K1);
const response = await device.Exchange(data);
const publickey = SecuxTransactionTool.resolvePublickey(
    response, 
    EllipticCurve.SECP256K1,
    true // SECP256K1 compress flag
);
```

2. Query extended publickey from SecuX Hardware Wallet
```ts
const data = SecuxTransactionTool.getXPublickey("m/44'/0'/0'/0/0");
const response = await device.Exchange(data);
const xpub = SecuxTransactionTool.resolveXPublickey(response, "m/44'/0'/0'/0/0");
```

# API Reference
Protocol layer of transaction related method

**Kind**: global class  

* [SecuxTransactionTool](#SecuxTransactionTool)
    * [.resolveResponse(response)](#SecuxTransactionTool.resolveResponse) ⇒ [<code>IAPDUResponse</code>](#IAPDUResponse)
    * [.getPublickey(path, curve)](#SecuxTransactionTool.getPublickey) ⇒ <code>communicationData</code>
    * [.resolvePublickey(response, curve, compressed)](#SecuxTransactionTool.resolvePublickey) ⇒ <code>string</code>
    * [.getXPublickey(path)](#SecuxTransactionTool.getXPublickey) ⇒ <code>communicationData</code>
    * [.resolveXPublickey(response, path)](#SecuxTransactionTool.resolveXPublickey) ⇒ <code>string</code>
    * [.signTransaction(path, tx, [option])](#SecuxTransactionTool.signTransaction) ⇒ <code>communicationData</code>
    * [.resolveSignature(response)](#SecuxTransactionTool.resolveSignature) ⇒ <code>string</code>
    * [.signTransactionList(paths, txs, [otpion])](#SecuxTransactionTool.signTransactionList) ⇒ <code>communicationData</code>
    * [.resolveSignatureList(response)](#SecuxTransactionTool.resolveSignatureList) ⇒ <code>Array.&lt;string&gt;</code>
    * [.signRawTransaction(path, tx, [option])](#SecuxTransactionTool.signRawTransaction) ⇒ <code>communicationData</code>
    * [.signRawTransactionList(paths, txs, [confirm], [otpion])](#SecuxTransactionTool.signRawTransactionList) ⇒ <code>communicationData</code>
    * [.signMessage(path, msg, [option])](#SecuxTransactionTool.signMessage) ⇒ <code>communicationData</code>
    * [.signTypedMessage(path, typedMessageHash, [option])](#SecuxTransactionTool.signTypedMessage) ⇒ <code>communicationData</code>
    * ~~[.txPrepare(path, inputId, tx, confirm, [isToken])](#SecuxTransactionTool.txPrepare) ⇒ <code>communicationData</code>~~
    * ~~[.txBegin(amount, toAddress, [showConfirm])](#SecuxTransactionTool.txBegin) ⇒ <code>communicationData</code>~~
    * ~~[.txEnd()](#SecuxTransactionTool.txEnd) ⇒ <code>communicationData</code>~~
    * ~~[.txSign(inputId)](#SecuxTransactionTool.txSign) ⇒ <code>communicationData</code>~~

<br/>
<a name="SecuxTransactionTool.resolveResponse"></a>

### **SecuxTransactionTool.resolveResponse(response) ⇒ [<code>IAPDUResponse</code>](#IAPDUResponse)**
*Resolve response from device.*

**Returns**: [<code>IAPDUResponse</code>](#IAPDUResponse) - response object  

| Param | Type | Description |
| --- | --- | --- |
| response | <code>communicationData</code> | data from device |

<br/>
<a name="SecuxTransactionTool.getPublickey"></a>

### **SecuxTransactionTool.getPublickey(path, curve) ⇒ <code>communicationData</code>**
*Query publickey (uncompressed) command.*

**Returns**: <code>communicationData</code> - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | BIP32 |
| curve | [<code>EllipticCurve</code>](#EllipticCurve) | 0: SECP256K1, 1: ED25519 |

<br/>
<a name="SecuxTransactionTool.resolvePublickey"></a>

### **SecuxTransactionTool.resolvePublickey(response, curve, compressed) ⇒ <code>string</code>**
*Reslove publickey from SecuX device.*

**Returns**: <code>string</code> - publickey (base64 encoded)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| response | <code>communicationData</code> |  | data from device |
| curve | [<code>EllipticCurve</code>](#EllipticCurve) |  | 0: SECP256K1, 1: ED25519 |
| compressed | <code>boolean</code> | <code>true</code> | setting for secp256k1 |

<br/>
<a name="SecuxTransactionTool.getXPublickey"></a>

### **SecuxTransactionTool.getXPublickey(path) ⇒ <code>communicationData</code>**
*Query extended publickey command.*

**Returns**: <code>communicationData</code> - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | BIP32 |

<br/>
<a name="SecuxTransactionTool.resolveXPublickey"></a>

### **SecuxTransactionTool.resolveXPublickey(response, path) ⇒ <code>string</code>**
*Reslove extended publickey from SecuX device.*

**Returns**: <code>string</code> - xpub  

| Param | Type | Description |
| --- | --- | --- |
| response | <code>communicationData</code> | data from device |
| path | <code>string</code> | BIP32 |

<br/>
<a name="SecuxTransactionTool.signTransaction"></a>

### **SecuxTransactionTool.signTransaction(path, tx, [option]) ⇒ <code>communicationData</code>**
*Sign a hashed transcation command.*

**Returns**: <code>communicationData</code> - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | BIP32 |
| tx | <code>communicationData</code> | prepared transaction data |
| [option] | [<code>TransactionOption</code>](#TransactionOption) |  |

<br/>
<a name="SecuxTransactionTool.resolveSignature"></a>

### **SecuxTransactionTool.resolveSignature(response) ⇒ <code>string</code>**
*Reslove signature from SecuX device.*

**Returns**: <code>string</code> - signature (base64 encoded)  

| Param | Type | Description |
| --- | --- | --- |
| response | <code>communicationData</code> | data from device |

<br/>
<a name="SecuxTransactionTool.signTransactionList"></a>

### **SecuxTransactionTool.signTransactionList(paths, txs, [otpion]) ⇒ <code>communicationData</code>**
*Sign hashed transactions command.*

**Returns**: <code>communicationData</code> - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| paths | <code>Array.&lt;string&gt;</code> | BIP32 |
| txs | <code>Array.&lt;Buffer&gt;</code> | prepared transaction data corresponding to above path |
| [otpion] | [<code>TransactionOption</code>](#TransactionOption) |  |

<br/>
<a name="SecuxTransactionTool.resolveSignatureList"></a>

### **SecuxTransactionTool.resolveSignatureList(response) ⇒ <code>Array.&lt;string&gt;</code>**
*Reslove signature from SecuX device.*

**Returns**: <code>Array.&lt;string&gt;</code> - signature array of base64 string  

| Param | Type | Description |
| --- | --- | --- |
| response | <code>communicationData</code> | data from device |

<br/>
<a name="SecuxTransactionTool.signRawTransaction"></a>

### **SecuxTransactionTool.signRawTransaction(path, tx, [option]) ⇒ <code>communicationData</code>**
*Sign a transcation command.*

**Returns**: <code>communicationData</code> - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | BIP32 |
| tx | <code>communicationData</code> | prepared transaction data |
| [option] | [<code>TransactionOption</code>](#TransactionOption) |  |

<br/>
<a name="SecuxTransactionTool.signRawTransactionList"></a>

### **SecuxTransactionTool.signRawTransactionList(paths, txs, [confirm], [otpion]) ⇒ <code>communicationData</code>**
*Sign transactions command.*

**Returns**: <code>communicationData</code> - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| paths | <code>Array.&lt;string&gt;</code> | BIP32 |
| txs | <code>Array.&lt;Buffer&gt;</code> | prepared transaction data corresponding to above path |
| [confirm] | <code>communicationData</code> |  |
| [otpion] | [<code>TransactionOption</code>](#TransactionOption) |  |

<br/>
<a name="SecuxTransactionTool.signMessage"></a>

### **SecuxTransactionTool.signMessage(path, msg, [option]) ⇒ <code>communicationData</code>**
*Sign message command.*

**Returns**: <code>communicationData</code> - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | BIP32 |
| msg | <code>communicationData</code> |  |
| [option] | <code>MessageOption</code> |  |

<br/>
<a name="SecuxTransactionTool.signTypedMessage"></a>

### **SecuxTransactionTool.signTypedMessage(path, typedMessageHash, [option]) ⇒ <code>communicationData</code>**
*Sign typed message command.*

**Returns**: <code>communicationData</code> - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | BIP32 |
| typedMessageHash | <code>communicationData</code> |  |
| [option] | <code>MessageOption</code> |  |

<br/>
<a name="SecuxTransactionTool.txPrepare"></a>

### **~~SecuxTransactionTool.txPrepare(path, inputId, tx, confirm, [isToken]) ⇒ <code>communicationData</code>~~**
***Deprecated***

*Send utxo command.*

**Returns**: <code>communicationData</code> - data for sending to device  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| path | <code>string</code> |  | BIP32 |
| inputId | <code>number</code> |  | uint8 |
| tx | <code>communicationData</code> |  |  |
| confirm | <code>communicationData</code> |  |  |
| [isToken] | <code>boolean</code> | <code>false</code> |  |

<br/>
<a name="SecuxTransactionTool.txBegin"></a>

### **~~SecuxTransactionTool.txBegin(amount, toAddress, [showConfirm]) ⇒ <code>communicationData</code>~~**
***Deprecated***

*Begin signing command.*

**Returns**: <code>communicationData</code> - data for sending to device  

| Param | Type | Default |
| --- | --- | --- |
| amount | <code>string</code> |  | 
| toAddress | <code>string</code> |  | 
| [showConfirm] | <code>boolean</code> | <code>false</code> | 

<br/>
<a name="SecuxTransactionTool.txEnd"></a>

### **~~SecuxTransactionTool.txEnd() ⇒ <code>communicationData</code>~~**
***Deprecated***

*End signing command.*

**Returns**: <code>communicationData</code> - data for sending to device  
<br/>
<a name="SecuxTransactionTool.txSign"></a>

### **~~SecuxTransactionTool.txSign(inputId) ⇒ <code>communicationData</code>~~**
***Deprecated***

*Sign command.*

**Returns**: <code>communicationData</code> - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| inputId | <code>number</code> | uint8 |

<br/>

<br/>
<a name="IAPDUResponse"></a>

## IAPDUResponse
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| status | <code>number</code> | StatusCode |
| data | <code>string</code> | base64 encoded |
| dataLength | <code>number</code> | length of the data |

<br/>
<a name="StatusCode"></a>

## StatusCode
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| DATA_ERROR | <code>number</code> | 0x5001 |
| CLA_ERROR | <code>number</code> | 0x5002 |
| INS_ERROR | <code>number</code> | 0x5003 |
| SUCCESS | <code>number</code> | 0x9000 |

<br/>
<a name="TransactionType"></a>

## TransactionType
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| NORMAL | <code>number</code> | 0 |
| TOKEN | <code>number</code> | 1 |
| NFT | <code>number</code> | 2 |

<br/>
<a name="EllipticCurve"></a>

## EllipticCurve
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| SECP256K1 | <code>number</code> | 0 |
| ED25519 | <code>number</code> | 1 |

<br/>
<a name="TransactionOption"></a>

## TransactionOption
**Properties**

| Name | Type |
| --- | --- |
| tp | [<code>TransactionType</code>](#TransactionType) | 
| curve | [<code>EllipticCurve</code>](#EllipticCurve) | 
| chainId | <code>number</code> | 

<br/>

* * *

&copy; 2018-21 SecuX Technology Inc.

authors:<br/>
andersonwu@secuxtech.com