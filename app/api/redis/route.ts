import { NextResponse } from 'next/server';
import { checkRedisConnection, redis } from '@/app/services/redis';

export async function GET(request: Request) {
  try {
    await checkRedisConnection();
    
    // Ambil parameter key dari URL
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    
    if (key) {
      // Jika key spesifik diminta
      const type = await redis.type(key);
      let data;
      
      switch(type) {
        case 'string':
          data = await redis.get(key);
          break;
        case 'hash':
          data = await redis.hgetall(key);
          break;
        case 'list':
          data = await redis.lrange(key, 0, -1);
          break;
        case 'set':
          data = await redis.smembers(key);
          break;
        case 'zset':
          data = await redis.zrange(key, 0, -1, 'WITHSCORES');
          break;
        default:
          return NextResponse.json(
            { status: 'error', message: 'Key tidak ditemukan' },
            { status: 404 }
          );
      }
      
      return NextResponse.json({ 
        status: 'success', 
        message: 'Data Redis berhasil diambil',
        data
      });
    }
    
    // Mendapatkan semua kunci
    const keys = await redis.keys('*');
    
    // Definisikan tipe untuk allData
    const allData: Record<string, any> = {};
    
    // Iterasi melalui setiap kunci
    for (const key of keys) {
      const type = await redis.type(key);
      
      switch(type) {
        case 'string':
          allData[key] = await redis.get(key);
          break;
        case 'hash':
          allData[key] = await redis.hgetall(key);
          break;
        case 'list':
          allData[key] = await redis.lrange(key, 0, -1);
          break;
        case 'set':
          allData[key] = await redis.smembers(key);
          break;
        case 'zset':
          allData[key] = await redis.zrange(key, 0, -1, 'WITHSCORES');
          break;
        default:
          allData[key] = `Tipe data tidak didukung: ${type}`;
      }
    }
    
    return NextResponse.json({ 
      status: 'success', 
      message: 'Data Redis berhasil diambil',
      data: allData
    });
  } catch (error) {
    console.error('Gagal mengambil data dari Redis:', error);
    return NextResponse.json(
      { status: 'error', message: 'Gagal mengambil data dari Redis' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await checkRedisConnection();
    
    const body = await request.json();
    const { key, value, type = 'string' } = body;
    
    if (!key || value === undefined) {
      return NextResponse.json(
        { status: 'error', message: 'Key dan value harus disediakan' },
        { status: 400 }
      );
    }

    switch(type.toLowerCase()) {
      case 'string':
        await redis.set(key, typeof value === 'string' ? value : JSON.stringify(value));
        break;
      case 'hash':
        if (typeof value !== 'object') {
          throw new Error('Value untuk tipe hash harus berupa object');
        }
        await redis.hmset(key, value);
        break;
      case 'list':
        if (!Array.isArray(value)) {
          throw new Error('Value untuk tipe list harus berupa array');
        }
        await redis.del(key); // Hapus list yang ada jika ada
        await redis.rpush(key, ...value);
        break;
      case 'set':
        if (!Array.isArray(value)) {
          throw new Error('Value untuk tipe set harus berupa array');
        }
        await redis.del(key); // Hapus set yang ada jika ada
        await redis.sadd(key, ...value);
        break;
      default:
        throw new Error(`Tipe data tidak didukung: ${type}`);
    }

    return NextResponse.json({
      status: 'success',
      message: 'Data berhasil disimpan ke Redis',
      data: { key, type }
    });
  } catch (error) {
    console.error('Gagal menyimpan data ke Redis:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: `Gagal menyimpan data ke Redis: ${error instanceof Error ? error.message : 'Unknown error'}` 
      },
      { status: 500 }
    );
  }
}
