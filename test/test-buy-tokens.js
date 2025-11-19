#!/usr/bin/env node

import 'dotenv/config';
import {
  Account,
  Args,
  Mas,
  JsonRpcProvider,
} from '@massalabs/massa-web3';

const TOKEN_CONTRACT_ADDRESS = process.env.TOKEN_CONTRACT_ADDRESS || 'AS12u3neY6CN9AtAvtaNBz74sHHfvpma5kWFXvikhuAv2Tmse7RA8';

async function testBuyTokens() {
  console.log('🧪 Testing buyTokens function...');
  console.log('═══════════════════════════════════════════════');

  try {
    const account = await Account.fromPrivateKey(process.env.PRIVATE_KEY);
    const provider = JsonRpcProvider.buildnet(account);
    
    console.log(`📍 Buyer: ${account.address}`);
    console.log(`🪙 Token Contract: ${TOKEN_CONTRACT_ADDRESS}`);
    console.log();

    // Buy 0.1 MASSA worth of tokens
    const massaAmount = Mas.fromString('0.1');
    
    console.log('💰 Buying tokens with 0.1 MASSA...');
    
    const result = await provider.callSC({
      target: TOKEN_CONTRACT_ADDRESS,
      func: 'buyTokens',
      parameter: new Args().serialize(),
      coins: massaAmount,
      fee: Mas.fromString('0.01'),
      maxGas: BigInt(2000000000),
    });

    console.log(`✅ Purchase successful!`);
    console.log(`   Operation ID: ${result.id}`);
    
    // Wait for confirmation
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check events
    const events = await provider.getEvents({
      smartContractAddress: TOKEN_CONTRACT_ADDRESS,
    });
    
    const recentEvents = events.slice(-3);
    console.log();
    console.log('📋 Recent events:');
    recentEvents.forEach((event, i) => {
      console.log(`   ${i + 1}. ${event.data}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    if (error.message) {
      console.error('Message:', error.message);
    }
  }
}

testBuyTokens();
