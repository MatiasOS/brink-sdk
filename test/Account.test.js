const { ethers } = require('hardhat')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const { solidity } = require('ethereum-waffle')
const { randomHex } = require('web3-utils')
const BigNumber = require('bignumber.js')
const { constants } = require('@brinkninja/utils')
const computeAccountAddress = require('../src/computeAccountAddress')
const BN = ethers.BigNumber.from
const { MAX_UINT256 } = constants
chai.use(chaiAsPromised)
chai.use(solidity)
const { expect } = chai

const randomAddress = '0x13be228b8fc66ef382f0615f385b50710313a188'

describe('Account', function () {

  beforeEach(async function () {
    this.LimitSwapVerifier = await ethers.getContractFactory('LimitSwapVerifierMock')
    this.MockAccount = await ethers.getContractFactory('MockAccount')
    this.account_limitSwapVerifier = this.LimitSwapVerifier.attach(this.account.address)

    this.recipientAddress = randomHex(20)
  })

  describe('populateTransaction', function () {
    it('should wrap call to ethers populateTranscation', async function () {
      const signedEthToTokenSwap = await this.accountSigner.signEthToTokenSwap(
        '0', '1', this.token.address, '10', '10'
      )
      const res = await this.account.populateTransaction.sendLimitSwap(signedEthToTokenSwap, randomAddress, '0x0123')
      const { contractName, functionName, params, paramTypes, data, to, from } = res
      expect(contractName).not.to.be.undefined
      expect(functionName).not.to.be.undefined
      expect(params).not.to.be.undefined
      expect(paramTypes).not.to.be.undefined
      expect(data).not.to.be.undefined
      expect(to).not.to.be.undefined
      expect(from).not.to.be.undefined
    })
  })

  describe('estimateGas', function () {
    it('should wrap call to ethers estimateGas', async function () {
      const signedEthToTokenSwap = await this.accountSigner.signEthToTokenSwap(
        '0', '1', this.token.address, '10', '10'
      )
      const res = await this.account.estimateGas.sendLimitSwap(signedEthToTokenSwap, randomAddress, '0x0123')
      expect(res.gas).to.be.gt(0)
    })
  })

  describe('callStatic', function () {
    it('should wrap call to ethers callStatic', async function () {
      const signedEthToTokenSwap = await this.accountSigner.signEthToTokenSwap(
        '0', '1', this.token.address, '10', '10'
      )
      const res = await this.account.callStatic.sendLimitSwap(signedEthToTokenSwap, randomAddress, '0x0123')
      expect(res.returnValues).not.to.be.undefined
    })
  })

  describe('sendLimitSwap', function () {
    it('should send a limit swap tx', async function () {
      const signedEthToTokenSwap = await this.accountSigner.signEthToTokenSwap(
        '0', '1', this.token.address, '10', '10'
      )
      await expect(this.account.sendLimitSwap(signedEthToTokenSwap, randomAddress, '0x0123'))
        .to.emit(this.account_limitSwapVerifier, 'EthToToken')
        .withArgs(
          '0', '1', ethers.utils.getAddress(this.token.address), '10', '10', MAX_UINT256,
          ethers.utils.getAddress(randomAddress), '0x0123'
        )
    })
  })

  describe('deploy', function () {
    describe('when given valid params', function () {
      beforeEach(async function () {
        await this.account.deploy()
      })

      it('should deploy the account', async function () {
        expect(await this.account.isDeployed()).to.be.true
      })

      it('should set the account address', function () {
        const expectedAccountAddress = computeAccountAddress(
          this.singletonFactory.address,
          this.accountContract.address,
          this.ownerAddress,
          this.accountSalt
        )
        expect(this.account.address).to.equal(expectedAccountAddress)
      })
    })

    describe('when account is already deployed', function () {
      it('should throw an error', async function () {
        await this.account.deploy()
        await expect(this.account.deploy()).to.be.rejectedWith('Account contract already deployed')
      })
    })
  })

  describe('externalCall', function () {
    beforeEach(async function () {
      await this.account.deploy()
    })

    it('should send externalCall tx', async function () {
      await this.defaultSigner.sendTransaction({
        to: this.account.address,
        value: ethers.utils.parseEther('1.0')
      })
      const transferAmount = await ethers.utils.parseEther('0.01')
      const tx = await this.account_ownerSigner.externalCall(transferAmount.toString(), this.recipientAddress, '0x')
      expect(tx).to.not.be.undefined
      expect(await ethers.provider.getBalance(this.recipientAddress)).to.equal(ethers.utils.parseEther('0.01'))
    })
  })

  describe('delegateCall', function () {
    beforeEach(async function () {
      await this.account.deploy()
    })

    it('should send delegateCall tx', async function () {
      await this.defaultSigner.sendTransaction({
        to: this.account.address,
        value: ethers.utils.parseEther('1.0')
      })
      const transferAmount = await ethers.utils.parseEther('0.01')
      const transferEthData = await this.encodeEthTransfer('0', '1', this.recipientAddress, transferAmount.toString())
      const tx = await this.account_ownerSigner.delegateCall(this.transferVerifier.address, transferEthData)
      expect(tx).to.not.be.undefined
      expect(await ethers.provider.getBalance(this.recipientAddress)).to.equal(ethers.utils.parseEther('0.01'))
    })
  })

  describe('metaDelegateCall', function () {
    beforeEach(async function () {
      this.transferAmt = ethers.utils.parseEther('1.0')
      await this.defaultSigner.sendTransaction({
        to: this.account.address,
        value: this.transferAmt
      })
    })

    it('should send tx for metaDelegateCall', async function () {
      const signedUpgradeFnCall = await this.accountSigner.signEthTransfer(
        '0', '1', this.recipientAddress, this.transferAmt.toString(), MAX_UINT256
      )
      const to = signedUpgradeFnCall.signedParams[0].value
      const data = signedUpgradeFnCall.signedParams[1].value
      const signature = signedUpgradeFnCall.signature
      
      const tx = await this.account.metaDelegateCall(to, data, signature)
      expect(tx).to.not.be.undefined
      expect(await ethers.provider.getBalance(this.recipientAddress)).to.equal(ethers.utils.parseEther('1.0'))
    })
  })

  describe('metaPartialSignedDelegateCall', function () {
    it('should send tx for metaPartialSignedDelegateCall', async function () {
      await this.account.deploy()
      const signedEthToTokenSwap = await this.accountSigner.signEthToTokenSwap(
        '0', '1', this.token.address, '10', '10', MAX_UINT256
      )
      const { signedData, unsignedData } = this.account.getLimitSwapData(signedEthToTokenSwap, randomAddress, '0x0123')
      await expect(this.account.metaPartialSignedDelegateCall(
        signedEthToTokenSwap.signedParams[0].value, signedData, signedEthToTokenSwap.signature, unsignedData
      ))
        .to.emit(this.account_limitSwapVerifier, 'EthToToken')
        .withArgs(
          '0', '1', ethers.utils.getAddress(this.token.address), '10', '10', MAX_UINT256,
          ethers.utils.getAddress(randomAddress), '0x0123'
        )
    })
  })

  describe('isDeployed()', function () {
    it('should return true when contract is deployed', async function () {
      await this.account.deploy()
      expect(await this.account.isDeployed()).to.be.true
    })
  })

  describe.only('nextBit()', function () {
    describe('when the account proxy is deployed', function () {
      it('should return next available bit', async function () {
        await this.account.deploy()
        const { bitmapIndex, bit } = await this.account.nextBit()
        expect(bitmapIndex).to.equal(0)
        expect(bit).to.equal(1)
      })
    })

    describe('when the account proxy has not been deployed', function () {
      it('should return the first bit', async function () {
        const { bitmapIndex, bit } = await this.account.nextBit()
        expect(bitmapIndex).to.equal(0)
        expect(bit).to.equal(1)
      })
    })

    describe('when bits have been stored consecutively', function () {
      it('should return first available bit after stored bits', async function () {
        await this.account.deploy()
        await this.proxyAccountContract.__mockBitmap(0, base2BN('111'))
        const { bitmapIndex, bit } = await this.account.nextBit()
        const expectedBitIndex = BN(3)
        expect(bitmapIndex).to.equal(BN(0))
        expect(bit).to.equal(BN(2).pow(expectedBitIndex))
      })
    })

    describe('when bits have been stored non-consecutively', function () {
      it('should return first available bit', async function () {
        await this.account.deploy()
        // mock first 4 bits flipped, 5th unflipped, 6 and 7th flipped
        await this.proxyAccountContract.__mockBitmap(BN(0), base2BN(reverseBinStr('1111011')))
        const { bitmapIndex, bit } = await this.account.nextBit()
        const expectedBitIndex = BN(4)
        expect(bitmapIndex).to.equal(BN(0))
        expect(bit).to.equal(BN(2).pow(expectedBitIndex))
      })
    })

    describe('when exactly 256 bits have been stored', function () {
      it('should return first bit from the next storage slot', async function () {
        await this.account.deploy()
        // mock 256 bits flipped
        await this.proxyAccountContract.__mockBitmap(BN(0), base2BN('1111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111'))
        const { bitmapIndex, bit } = await this.account.nextBit()
        const expectedBitIndex = BN(0)
        expect(bitmapIndex).to.equal(BN(1))
        expect(bit).to.equal(BN(2).pow(expectedBitIndex))
      })
    })
  })
})

// convert a base 2 (binary) string to an ethers.js BigNumber
function base2BN (str) {
  // uses the bignumber.js lib which supports base 2 conversion
  return BN(new BigNumber(str, 2).toFixed())
}

function reverseBinStr (str) {
  return str.split('').reverse().join('')
}
