import assert from 'node:assert/strict'
import test from 'node:test'
import { getInventoryItemCounts, getInventoryItems, getVitalDecreaseConfirmation } from '../src/lib/itemInventory.ts'

const item = (overrides) => ({
    id: 'item-id',
    user_id: 'player-id',
    name: 'Test item',
    description: null,
    item_type: 'consumable',
    rarity: 'common',
    quantity: 1,
    is_equipped: false,
    stat_bonus: {},
    created_at: '',
    updated_at: '',
    ...overrides,
})

test('inventory tabs include only equipped gear/materials and available consumables', () => {
    const items = [
        item({ id: 'equipped-gear', item_type: 'equipment', is_equipped: true }),
        item({ id: 'unequipped-gear', item_type: 'equipment' }),
        item({ id: 'equipped-consumable', is_equipped: true }),
        item({ id: 'used-consumable', quantity: 0 }),
        item({ id: 'equipped-material', item_type: 'material', is_equipped: true }),
        item({ id: 'unequipped-material', item_type: 'material' }),
    ]

    assert.deepEqual(getInventoryItems(items, 'equipment').map(({ id }) => id), ['equipped-gear'])
    assert.deepEqual(getInventoryItems(items, 'consumable').map(({ id }) => id), ['equipped-consumable'])
    assert.deepEqual(getInventoryItems(items, 'material').map(({ id }) => id), ['equipped-material'])
    assert.deepEqual(getInventoryItemCounts(items), { equipment: 1, consumable: 1, material: 1 })
})

test('vital decreases require confirmation and use player-facing labels', () => {
    assert.equal(
        getVitalDecreaseConfirmation({ hp: -15 }),
        'This will reduce Body by 15. Use anyway?',
    )
    assert.equal(
        getVitalDecreaseConfirmation({ hp: -15, energy: -10 }),
        'This will reduce Body by 15 and Energy by 10. Use anyway?',
    )
    assert.equal(getVitalDecreaseConfirmation({ energy: 10, strength: 2 }), null)
})
