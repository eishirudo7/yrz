import { NextResponse } from 'next/server'

const API_URL = 'https://otpcepat.org/api/handler_api.php'
const API_KEY = '6903963f5bc841369356ff373600f12b'
const DEFAULT_COUNTRY_ID = '6'
const DEFAULT_SERVICE_ID = '288'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  
  let apiUrl = `${API_URL}?api_key=${API_KEY}`
  
  // Helper function untuk mengurangi duplikasi kode
  async function fetchData(url: string) {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache'
      }
    })
    return response.json()
  }
  
  try {
    switch (action) {
      case 'order': {
        const operatorId = searchParams.get('operator_id')
        
        if (!operatorId) {
          return NextResponse.json(
            { status: false, message: 'Missing operator_id parameter' },
            { status: 400 }
          )
        }

        apiUrl += `&action=get_order&operator_id=${operatorId}&service_id=${DEFAULT_SERVICE_ID}&country_id=${DEFAULT_COUNTRY_ID}`
        const data = await fetchData(apiUrl)
        return NextResponse.json(data)
      }

      case 'balance':
        apiUrl += `&action=getBalance`
        break

      case 'active_order':
        apiUrl += `&action=active_order`
        break

      case 'status': {
        const statusOrderId = searchParams.get('order_id')
        
        if (!statusOrderId) {
          return NextResponse.json(
            { status: false, message: 'Missing order_id parameter' },
            { status: 400 }
          )
        }

        apiUrl += `&action=get_status&order_id=${statusOrderId}`
        const data = await fetchData(apiUrl)
        return NextResponse.json(data)
      }

      case 'set_status': {
        const setStatusOrderId = searchParams.get('order_id')
        const status = searchParams.get('status')
        
        if (!setStatusOrderId || !status) {
          return NextResponse.json(
            { status: false, message: 'Missing required parameters' },
            { status: 400 }
          )
        }

        const validStatuses = ['2', '3', '4']
        if (!validStatuses.includes(status)) {
          return NextResponse.json(
            { status: false, message: 'Invalid status. Must be 2 (Cancel), 3 (Resend SMS), or 4 (Finish)' },
            { status: 400 }
          )
        }

        apiUrl += `&action=set_status&order_id=${setStatusOrderId}&status=${status}`
        const data = await fetchData(apiUrl)
        return NextResponse.json(data)
      }

      default:
        return NextResponse.json({ status: false, message: 'Invalid action' }, { status: 400 })
    }

    // Hanya dieksekusi untuk case 'balance' dan 'active_order'
    const data = await fetchData(apiUrl)
    return NextResponse.json(data)

  } catch (error) {
    return NextResponse.json(
      { status: false, message: 'Server error' },
      { status: 500 }
    )
  }
} 