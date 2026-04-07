import { describe, it, expect } from 'vitest'
import {
  emptyArtistCounts, startGame, playCard, playSecondCard, passSecondCard,
  setFixedPrice, acceptFixedPrice, passFixedPrice,
  placeOpenBid, endOpenAuction, placeOnceAroundBid, submitSealedBid, endRound,
} from './engine'
import type { GameState, PlayerRecord, Card, Artist, AuctionType } from '../types/game'
import { ROUND_END_THRESHOLD } from '../types/game'

describe('round-end trigger', () => {
  it.todo('fires when 5th painting is played, returning roundEnded true and auction null')
})

describe('open auction', () => {
  it.todo('places and ends bids correctly')
})

describe('once-around auction', () => {
  it.todo('cycles through players and resolves at auctioneer')
})

describe('sealed bid — resolution and tie-breaking', () => {
  it.todo('auctioneer wins a tie when amounts equal')
})

describe('fixed price auction', () => {
  it.todo('transfers money to auctioneer on accept')
})

describe('double auction — second card mechanics', () => {
  it.todo('passes second card clockwise and wraps to auctioneer')
})

describe('cumulative round valuation', () => {
  it.todo('carries roundValues forward across rounds')
})

describe('startGame', () => {
  it.todo('deals hands and sets money to 100000')
})
