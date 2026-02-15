import { NextResponse } from 'next/server'
import { loadEmployees } from '@/lib/employees'

export async function GET() {
  try {
    const employees = await loadEmployees()
    return NextResponse.json({ employees })
  } catch (error) {
    console.error('[api/employees] Failed to load employees:', error)
    return NextResponse.json({ employees: [] }, { status: 500 })
  }
}
