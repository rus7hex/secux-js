const { mnemonicToSeedSync } = require("bip39");
const { fromSeed } = require("bip32");
const btc = require("./test_btc");
const bch = require("./test_bch");
const ltc = require("./test_ltc");
const grs = require("./test_grs");
const dgb = require("./test_dgb");
const dash = require("./test_dash");
const doge = require("./test_doge");


const mnemonic = "neither black arm fun match nominee north lock cave judge window juice humor list verify permit unfold unfair expect muscle human true spoil ancient";
const seed = mnemonicToSeedSync(mnemonic);
const root = fromSeed(seed);


export function test(GetDevice) {
    describe("SecuxBTC.getAddress()", () => {
        btc.test_address(GetDevice, root);
        bch.test_address(GetDevice, root);
        ltc.test_address(GetDevice, root);
        grs.test_address(GetDevice, root);
        dgb.test_address(GetDevice, root);
        dash.test_address(GetDevice, root);
        doge.test_address(GetDevice, root);
    });

    describe("SecuxBTC.signTransaction()", () => {
        btc.test_tx(GetDevice, root);
        bch.test_tx(GetDevice, root);
        ltc.test_tx(GetDevice, root);
        grs.test_tx(GetDevice, root);
        dgb.test_tx(GetDevice, root);
        dash.test_tx(GetDevice, root);
        doge.test_tx(GetDevice, root);
    });
}
