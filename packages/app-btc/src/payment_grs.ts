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


import { PaymentBTC, CoinType } from './payment';
import { bs58Check } from "@secux/utility/lib/bs58";
const groestl = require("groestl-hash-js");
export { PaymentGRS, CoinType };


class PaymentGRS extends PaymentBTC {
    protected static bs58check = new bs58Check(hash);

    protected static CoinSupported(coin: CoinType) {
        if (coin !== CoinType.GROESTL) throw Error('Not supported cointype');
    }
}

function hash(data: Buffer) {
    return Buffer.from(groestl.groestl_2(data, 1, 1));
}
