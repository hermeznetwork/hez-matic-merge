const Scalar = require("ffjavascript").Scalar;

function to18(num){
    return Scalar.mul(num, Scalar.pow(10, 18));
}

function toExp(num, exp){
    return Scalar.mul(num, Scalar.pow(10, exp));
}

module.exports = {
    to18,
    toExp,
};