import { describe, it, expect } from 'vitest'
const { successResponse, errorResponse } = require('../../cloudfunctions/api/utils/response')

describe('Cloud Function Response Utils', () => {
  it('should format success response correctly', () => {
    const res = successResponse({ id: '123' }, 'created')
    expect(res).toEqual({
      code: 0,
      message: 'created',
      data: { id: '123' }
    })
  })

  it('should default message to success', () => {
    const res = successResponse()
    expect(res).toEqual({
      code: 0,
      message: 'success',
      data: null
    })
  })

  it('should format error response with custom code', () => {
    const err = errorResponse('Invalid parameters', 40001, { field: 'title' })
    expect(err).toEqual({
      code: 40001,
      message: 'Invalid parameters',
      data: { field: 'title' }
    })
  })

  it('should format error response with default values', () => {
    const err = errorResponse()
    expect(err).toEqual({
      code: -1,
      message: 'fail',
      data: null
    })
  })
})
