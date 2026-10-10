import { defineChain, parseAbi } from 'viem'

export const monad = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } },
  blockExplorers: { default: { name: 'Monad Explorer', url: 'https://testnet.monadexplorer.com' } },
})

export const GOV = '0x48D8896D16a7EA7ef71C5e615b1cDb44501AD610'

export const govAbi = parseAbi([
  'function proposalCount() view returns (uint256)',
  'function hasVoted(uint256, address) view returns (bool)',
  'function getProposal(uint256) view returns ((address creator, string title, string description, uint64 startTime, uint64 endTime, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes))',
  'function createProposal(string title, string description, uint64 startTime, uint64 endTime) returns (uint256)',
  'function vote(uint256 proposalId, uint8 support)',
])
