import requests
import json
import threading
import time
from datetime import datetime
from supabase import create_client, Client
import logging
from logging.handlers import RotatingFileHandler
import os

# Konfigurasi logging
def setup_logging():
    log_directory = 'logs'
    if not os.path.exists(log_directory):
        os.makedirs(log_directory)

    log_file = os.path.join(log_directory, 'chatbot.log')

    # Konfigurasi format logging
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    
    # File handler untuk menyimpan log ke file
    file_handler = RotatingFileHandler(log_file, maxBytes=10*1024*1024, backupCount=5)
    file_handler.setFormatter(formatter)

    # Stream handler untuk menampilkan log di terminal
    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)

    # Konfigurasi logger
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    
    # Menghapus handler yang sudah ada
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)
        
    logger.addHandler(file_handler)
    logger.addHandler(stream_handler)

    # Mematikan log dari httpx
    logging.getLogger("httpx").setLevel(logging.WARNING)

# Kelas untuk mengelola koneksi dan operasi database
class DatabaseManager:
    def __init__(self, supabase_url, supabase_key):
        self.supabase = create_client(supabase_url, supabase_key)
        
    def get_config(self):
        config_chat = self.supabase.table('settings').select('*').execute()
        return config_chat.data[0] if config_chat.data else None
        
    def get_chat_status(self):
        return self.supabase.table('auto_ship_chat').select('shop_id, status_chat').execute()
        
    def tangani_keluhan(self, id_pengguna, nama_toko, jenis_keluhan, deskripsi_keluhan, 
                        nomor_invoice, status_pesanan, store_id, msg_id, user_id):
        try:
            # Memasukkan data keluhan ke Supabase
            result = self.supabase.table('keluhan').upsert({
                "id_pengguna": id_pengguna,
                "nama_toko": nama_toko,
                "jenis_keluhan": jenis_keluhan,
                "deskripsi_keluhan": deskripsi_keluhan,
                "nomor_invoice": nomor_invoice,
                "status_pesanan": status_pesanan,
                "store_id": store_id,
                "msg_id": msg_id,
                "user_id": user_id
            }, on_conflict=['nomor_invoice']).execute()

            logging.info(f"Data keluhan berhasil dimasukkan: {result.data}")
            return True
        except Exception as e:
            logging.error(f"Terjadi kesalahan saat memasukkan data keluhan: {e}")
            return False
            
    def ubah_detail_pesanan(self, id_pengguna, nama_toko, nomor_invoice, detail_perubahan, 
                           perubahan, status_pesanan, store_id, msg_id, user_id):
        try:
            # Memasukkan data perubahan pesanan ke Supabase
            result = self.supabase.table('perubahan_pesanan').upsert({
                "id_pengguna": id_pengguna,
                "nama_toko": nama_toko,
                "nomor_invoice": nomor_invoice,
                "detail_perubahan": detail_perubahan,
                "perubahan": perubahan,
                "status_pesanan": status_pesanan,
                "store_id": store_id,
                "msg_id": msg_id,
                "user_id": user_id
            }, on_conflict=['nomor_invoice']).execute()
            logging.info(f"Data perubahan pesanan berhasil dimasukkan: {result.data}")
            return True
        except Exception as e:
            logging.error(f"Terjadi kesalahan saat memasukkan data perubahan pesanan: {e}")
            return False

# Kelas untuk mengelola API dan permintaan HTTP
class ApiService:
    @staticmethod
    def cek_keluhan_dan_perubahan(user_id):
        try:
            url = f"https://yorozuya.me/api/cek_perubahan?user_id={user_id}"
            response = requests.get(url)
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "ada_keluhan": data.get("ada_keluhan", False),
                    "ada_perubahan": data.get("ada_perubahan", False),
                    "detail_keluhan": data.get("keluhan_detail", []),
                    "detail_perubahan": data.get("perubahan_detail", []),
                    "jumlah_keluhan": data.get("jumlah_keluhan", 0),
                    "jumlah_perubahan": data.get("jumlah_perubahan", 0)
                }
            else:
                logging.error(f"Gagal mengecek keluhan/perubahan: {response.status_code}")
                return {
                    "ada_keluhan": False,
                    "ada_perubahan": False,
                    "detail_keluhan": [],
                    "detail_perubahan": [],
                    "jumlah_keluhan": 0,
                    "jumlah_perubahan": 0
                }
                
        except Exception as e:
            logging.error(f"Error saat cek keluhan dan perubahan: {str(e)}")
            return {
                "ada_keluhan": False,
                "ada_perubahan": False,
                "detail_keluhan": [],
                "detail_perubahan": []
            }
    
    @staticmethod
    def ambil_data_pesanan_shopee(user_id):
        url = f"https://yorozuya.me/api/order_details?user_id={user_id}"
        try:
            response = requests.get(url)
            if response.status_code == 200:
                data = response.json()
                if len(data.get('data', [])) > 0:
                    return data
            return None
        except requests.exceptions.ConnectionError as e:
            return None
        except Exception as e:
            return None
    
    @staticmethod
    def jalankan_proses_order():
        url = "https://yorozuya.me/api/proses_order"
        try:
            response = requests.get(url)
            if response.status_code == 200:
                logging.info("✅ Berhasil menjalankan proses order di server")
                return True
            else:
                logging.error(f"❌ Gagal menjalankan proses order. Status code: {response.status_code}")
                return False
        except requests.exceptions.ConnectionError as e:
            logging.error(f"❌ Terjadi kesalahan koneksi saat menjalankan proses order: {str(e)}")
            return False
        except Exception as e:
            logging.error(f"❌ Terjadi kesalahan tidak terduga saat menjalankan proses order: {str(e)}")
            return False
    
    @staticmethod
    def reply_to_chat(chat, reply_text):
        url = "https://yorozuya.me/api/msg/send_message"
        
        try:
            # Pastikan data yang diperlukan ada
            if not isinstance(chat, dict):
                return None
                
            to_id = chat.get('buyer_id')
            shop_id = chat.get('shop_id')
            username = chat.get('username', 'Unknown')
            
            if not to_id or not shop_id:
                return None
                
            payload = {
                "toId": int(to_id),
                "messageType": "text",
                "content": reply_text,
                "shopId": int(shop_id)
            }
            
            response = requests.post(url, json=payload)
            response.raise_for_status()
            
            return response
            
        except Exception as e:
            return None

# Kelas untuk mengelola chatbot dan logika percakapan
class Chatbot:
    def __init__(self, db_manager, api_service, openai_api, request_model, temperature, system_data):
        self.db_manager = db_manager
        self.api_service = api_service
        self.openai_api = openai_api
        self.request_model = request_model
        self.temperature = temperature
        self.system_data = system_data
        
    def process_conversation(self, conversation, user_id, ada_pesanan, nomor_pesanan, 
                            store_id, conversation_id, user_id_int, jumlah_pesanan=0, daftar_pesanan=None):
        if ada_pesanan:
            hasil_cek = self.api_service.cek_keluhan_dan_perubahan(user_id_int)
            
            if hasil_cek['ada_keluhan']:
                return None
            elif hasil_cek['ada_perubahan']:
                detail_perubahan = hasil_cek.get('detail_perubahan', [])
                
                if detail_perubahan and len(detail_perubahan) > 0:
                    try:
                        detail = detail_perubahan[0]
                        perubahan = detail.get('perubahan', {})
                        pesan_perubahan = (
                            f"Sudah ada perubahan pesanan yang tercatat untuk nomor pesanan {nomor_pesanan}:\n\n"
                            f"• Detail perubahan: {detail.get('detail_perubahan', 'Tidak ada detail')}\n"
                            f"• Perubahan warna: {perubahan.get('warna', '-')}\n"
                            f"• Perubahan ukuran: {perubahan.get('ukuran', '-')}\n\n"
                        )
                        conversation.append({"role": "system", "content": pesan_perubahan})
                    except Exception as e:
                        logging.error(f"Error saat memproses detail perubahan: {str(e)}")
                        return None
                else:
                    logging.warning("Data perubahan detail kosong atau tidak valid")

        tools = [
            {
                "type": "function",
                "function": {
                    "name": "tangani_keluhan",
                    "description": "Menangani keluhan pelanggan terkait pesanan pelanggan dan menyimpannya di database",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "id_pengguna": {
                                "type": "string",
                                "description": "ID pengguna pelanggan yang mengajukan keluhan"
                            },
                            "nama_toko": {
                                "type": "string",
                                "description": "Nama toko yang dikeluhkan"
                            },
                            "status_pesanan": {
                                "type": "string",
                                "description": "Status pesanan saat ini"
                            },
                            "jenis_keluhan": {
                                "type": "string",
                                "enum": [
                                    "Produk Tidak Lengkap",
                                    "Produk Rusak",
                                ],
                                "description": "Jenis atau kategori keluhan"
                            },
                            "deskripsi_keluhan": {
                                "type": "string",
                                "description": "Deskripsi detail keluhan dari pelanggan"
                            },
                            "nomor_pesanan": {
                                "type": "string",
                                "description": "Nomor pesanan terkait keluhan"
                            }
                        },
                        "required": ["id_pengguna", "nama_toko", "jenis_keluhan", "deskripsi_keluhan", "nomor_pesanan", "status_pesanan"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "ubah_detail_pesanan",
                    "description": "Mencatat permintaan perubahan detail pesanan seperti warna atau ukuran",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "id_pengguna": {
                                "type": "string",
                                "description": "ID pengguna pelanggan yang mengajukan perubahan"
                            },
                            "nama_toko": {
                                "type": "string",
                                "description": "Nama toko yang dikeluhkan"
                            },
                            "nomor_pesanan": {
                                "type": "string",
                                "description": "Nomor pesanan terkait perubahan"
                            },
                            "status_pesanan": {
                                "type": "string",
                                "description": "Status pesanan saat ini"
                            },
                            'detail_perubahan':{
                                "type": "string",
                                "description": "Rangkuman perubahan yang diminta"
                            },
                            "perubahan": {
                                "type": "object",
                                "properties": {
                                    "warna": {
                                        "type": "string",
                                        "description": "Warna baru yang diminta jika ada perubahan"
                                    },
                                    "ukuran": {
                                        "type": "string",
                                        "description": "Ukuran baru yang diminta jika ada perubahan"
                                    }
                                },
                                "description": "Detail perubahan yang diminta"
                            }
                        },
                        "required": ["id_pengguna", "nama_toko", "detail_perubahan", "nomor_pesanan", "perubahan", "status_pesanan"]
                    }
                }
            }
        ]

        data = {
            "model": self.request_model,
            "messages": conversation,
            "temperature": self.temperature,
            "tools": tools,
            "tool_choice": "auto"
        }
        max_retries = 3

        # Tambahkan print data yang dikirim ke OpenAI
        print("==================== DATA YANG DIKIRIM KE OPENAI ====================")
        print(json.dumps(data, indent=2, ensure_ascii=False))
        print("====================================================================")

        for _ in range(max_retries):
            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {self.openai_api}"},
                json=data
            )
            print(response.json())

            if response.status_code == 200:
                response_data = response.json()["choices"][0]['message']

                if 'tool_calls' in response_data and ada_pesanan:
                    for tool_call in response_data['tool_calls']:
                        if tool_call['function']['name'] == 'tangani_keluhan':
                            args = json.loads(tool_call['function']['arguments'])
                            self.db_manager.tangani_keluhan(
                                args['id_pengguna'], 
                                args['nama_toko'], 
                                args['jenis_keluhan'], 
                                args['deskripsi_keluhan'], 
                                args['nomor_pesanan'],  # Menggunakan nomor_pesanan dari API sebagai nomor_invoice di database
                                args['status_pesanan'], 
                                store_id, 
                                conversation_id, 
                                user_id_int
                            )
                            return f"Terima kasih telah memberi tahu kami tentang {args['jenis_keluhan']}. Kami telah mencatat keluhan Anda terkait pesanan dengan nomor pesanan {nomor_pesanan} dan akan menanganinya sesegera mungkin."
                        elif tool_call['function']['name'] == 'ubah_detail_pesanan':
                            args = json.loads(tool_call['function']['arguments'])
                            try:
                                self.db_manager.ubah_detail_pesanan(
                                    args['id_pengguna'], 
                                    args['nama_toko'], 
                                    args['nomor_pesanan'],  # Menggunakan nomor_pesanan dari API sebagai nomor_invoice di database
                                    args['detail_perubahan'], 
                                    args['perubahan'], 
                                    args['status_pesanan'], 
                                    store_id, 
                                    conversation_id, 
                                    user_id_int
                                )
                                return f"Terima kasih telah memberi tahu kami tentang perubahan yang Anda inginkan untuk pesanan dengan nomor pesanan {args['nomor_pesanan']}. Kami telah mencatat perubahan tersebut dan akan menanganinya sesegera mungkin."
                            except Exception as e:
                                logging.error(f"Terjadi kesalahan saat memasukkan data perubahan pesanan: {e}")

                return response_data['content']
            elif response.status_code == 429:
                logging.warning("OpenAI API rate limit exceeded. Skipping...")
                return None
            else:
                logging.error(f"Error while calling OpenAI API: {response.status_code}, {response.text}")
                logging.info("Retrying...")
                time.sleep(5)

        logging.error(f"Failed after {max_retries} attempts")
        return None

# Kelas untuk mengelola proses chat
class ChatManager:
    def __init__(self, db_manager, api_service, chatbot, status_chat):
        self.db_manager = db_manager
        self.api_service = api_service
        self.chatbot = chatbot
        self.status_chat = status_chat
        
    def process_chat(self, conversation_id, shop_id, to_name, shop_name, unread_count, to_id):
        # Cek status chat untuk shop_id tertentu
        status_result = next((item for item in self.status_chat.data if item['shop_id'] == shop_id), None)
        if status_result and not status_result['status_chat']:
            logging.info(f"Skip membalas chat untuk shop_id {shop_id} karena status_chat = False")
            return
            
        userchat = f"https://yorozuya.me/api/msg/get_message?conversationId={conversation_id}&shopId={shop_id}&pageSize=25"
        
        try:
            rawconv = requests.get(userchat)
            conv_data = rawconv.json()
            
            # Periksa struktur response
            if 'response' not in conv_data or 'messages' not in conv_data['response']:
                logging.error("Struktur response tidak sesuai")
                return
                
            messages = conv_data['response']['messages']
            if not messages:
                logging.error("Tidak ada pesan dalam response")
                return
                
            messages.reverse()
            
            # Tambahkan pengecekan pesan terakhir untuk menghindari duplikasi
            last_message = messages[-1] if messages else None
            if last_message:
                message_type = last_message.get('message_type')
                if message_type not in ['text', 'image', 'sticker', 'video', "image_with_text"]:
                    logging.info(f"Pesan terakhir bukan text/image/sticker/video/image_with_text (type: {message_type}), skip balasan")
                    return
            
            # Ambil pesan pertama untuk mendapatkan informasi
            first_message = messages[0]
            
            chat = {
                'to_id': str(to_id),
                'to_name': to_name,
                'conversation_id': conversation_id,
                'shop_id': shop_id,
                'latest_message_id': first_message.get('message_id'),
                'latest_message_content': {
                    'text': first_message.get('content', {}).get('text', '')
                },
                'shop_name': shop_name
            }
            
            # Lanjutkan dengan logika yang ada
            percakapan = [
                {"role": "system", "content": self.chatbot.system_data}
            ]
           
            data_pesanan = self.api_service.ambil_data_pesanan_shopee(chat['to_id'])
            
            ada_pesanan = False
            nomor_pesanan = None
            status_pesanan = None
            jumlah_pesanan = 0
            store_id = chat.get('shop_id')
            conversation_id = chat.get('conversation_id')
            store_name = chat.get('shop_name')
            user_id = chat.get('to_id')
            daftar_pesanan = []

            if data_pesanan and 'data' in data_pesanan and len(data_pesanan['data']) > 0:
                jumlah_pesanan = len(data_pesanan['data'])
                pesanan = data_pesanan['data'][0]  # Mengambil pesanan terbaru
                ada_pesanan = True
                nomor_pesanan = pesanan.get('order_sn')  # Menggunakan order_sn sebagai nomor pesanan
                status_pesanan = pesanan.get('order_status')  # Menggunakan order_status
                
                # Menyimpan semua pesanan
                for p in data_pesanan['data']:
                    daftar_pesanan.append({
                        'nomor': p.get('order_sn'),
                        'status': p.get('order_status'),
                        'tanggal': datetime.fromtimestamp(p.get('create_time', 0)).strftime('%d-%m-%Y %H:%M:%S') if p.get('create_time') else 'Tidak diketahui',
                        'total': p.get('total_amount', 0)
                    })

            if ada_pesanan:
                if jumlah_pesanan == 1:
                    info_pesanan = f"Pelanggan memiliki pesanan dengan nomor pesanan {nomor_pesanan} dengan status pesanan {status_pesanan}."
                else:
                    # Membuat daftar semua pesanan
                    info_pesanan = f"Pelanggan memiliki {jumlah_pesanan} pesanan:\n\n"
                    for i, p in enumerate(daftar_pesanan, 1):
                        info_pesanan += f"{i}. Nomor pesanan: {p['nomor']}\n   Status: {p['status']}\n   Tanggal: {p['tanggal']}\n   Total: {p['total']}\n\n"
                    
                    # Tambahkan informasi tentang kebijakan pembatalan
                    info_pesanan += "Catatan: Karena pelanggan memiliki lebih dari 1 pesanan, jika ada pengajuan pembatalan dari pembeli maka akan diterima."
                
                percakapan.append({
                    "role": "system",
                    "content": f"Nama toko saat ini adalah {store_name} dan ID pelanggan adalah {chat['to_name']}. {info_pesanan}"
                })
            else:
                percakapan.append({
                    "role": "system",
                    "content": f"Nama toko saat ini adalah {store_name} dan ID pelanggan adalah {chat['to_name']}. "
                              f"Pelanggan belum memiliki pesanan. Jangan memproses keluhan atau ubah pesanan formal, tetapi tetap bantu dengan informasi umum jika diperlukan."
                })

            # Memproses pesan-pesan dari respons API baru
            for message in messages:
                if message.get('content', {}).get('text'):
                    peran = "user" if message['from_shop_id'] != store_id else "assistant"
                    percakapan.append({
                        "role": peran, 
                        "content": message['content']['text']
                    })
            
            teks_balasan = self.chatbot.process_conversation(
                percakapan, chat['to_name'], ada_pesanan, nomor_pesanan, 
                store_id, conversation_id, int(user_id), jumlah_pesanan, daftar_pesanan
            )
            
            logging.info("==========================================Balasan AI==========================================")
            if ada_pesanan:
                if jumlah_pesanan > 1:
                    logging.info(f"Jumlah pesanan: {jumlah_pesanan}")
                    for i, p in enumerate(daftar_pesanan, 1):
                        logging.info(f"Pesanan {i}: Nomor {p['nomor']} - Status {p['status']} - Tanggal {p['tanggal']} - Total {p['total']}")
                else:
                    logging.info(f"Nomor pesanan: {nomor_pesanan} - Status pesanan terbaru: {status_pesanan}")
            else:
                logging.info("Tidak ada pesanan")
           
            if teks_balasan is not None:
                logging.info(f"👤 {chat['to_name']}: {chat['latest_message_content']['text']}")
                logging.info(f"🤖 AI: {teks_balasan}")
                
                chat_data = {
                    'marketplace': 'shopee',
                    'shop_id': str(shop_id),
                    'conversation_id': conversation_id,
                    'buyer_id': str(to_id),
                    'balasan': teks_balasan,
                    'type': 'text',
                    'username': to_name
                }
                
                responbalas = self.api_service.reply_to_chat(chat_data, teks_balasan)
                if responbalas:
                    logging.info(f"✅ Pesan berhasil dikirim ke {chat['to_name']}")
                else:
                    logging.error(f"❌ Gagal mengirim pesan ke {chat['to_name']}")
            else:
                if ada_pesanan:
                    logging.info(f"Tidak ada balasan yang dikirim {chat['to_name']} karena keluhan sudah ada untuk nomor pesanan: {nomor_pesanan}, Status pesanan: {status_pesanan}")
                    return  # Menghentikan proses
                else:
                    logging.info("Tidak ada pesanan yang terkait dengan pengguna ini. Chat diproses normal.")

        except requests.exceptions.RequestException as e:
            logging.error(f"Error saat mengambil data dari API: {str(e)}")
            logging.error(f"Raw response: {rawconv.text if 'rawconv' in locals() else 'No response'}")
            return
        except (json.JSONDecodeError, KeyError) as e:
            logging.error(f"Error saat memproses data JSON: {str(e)}")
            logging.error(f"Raw response: {rawconv.text if 'rawconv' in locals() else 'No response'}")
            return
        except Exception as e:
            logging.error(f"Unexpected error: {str(e)}")
            logging.error(f"Raw response: {rawconv.text if 'rawconv' in locals() else 'No response'}")
            return
    
    def process_all_chats(self):
        try:
            datachat = requests.get("https://yorozuya.me/api/msg/get_conversation_list?unread=true&limit=20")
            
            if not datachat.ok:
                logging.error(f"Gagal mengambil data chat: Status code {datachat.status_code}")
                return
                
            data = datachat.json()
            if not data:
                logging.info("Tidak ada chat yang perlu diproses")
                return
                
            logging.info(f"Total chats ditemukan: {len(data)}")
            
            threads = []
            for chat in data:
                if not chat:
                    logging.error("Ditemukan chat yang kosong/invalid")
                    continue
                    
                try:
                    conversation_id = chat.get("conversation_id")
                    shop_id = chat.get("shop_id")
                    to_name = chat.get("to_name", "Unknown")
                    shop_name = chat.get("shop_name", "Unknown")
                    unread_count = chat.get("unread_count", 0)
                    to_id = chat.get("to_id")
                    
                    if not all([conversation_id, shop_id, to_id]):
                        logging.error(f"Data chat tidak lengkap: conversation_id={conversation_id}, shop_id={shop_id}, to_id={to_id}")
                        continue

                    thread = threading.Thread(target=self.process_chat, args=(
                        conversation_id,
                        shop_id,
                        to_name,
                        shop_name,
                        unread_count,
                        to_id
                    ))
                    thread.start()
                    threads.append(thread)
                    
                except Exception as e:
                    logging.error(f"Error processing chat: {str(e)}")
                    continue

            for thread in threads:
                thread.join()

        except requests.exceptions.RequestException as e:
            logging.error(f"Error saat mengambil data dari API: {str(e)}")
        except json.JSONDecodeError as e:
            logging.error(f"Error saat parsing JSON response: {str(e)}")
        except Exception as e:
            logging.error(f"Error tidak terduga dalam send_replies: {str(e)}")

# Fungsi utama
def main():
    # Setup logging
    setup_logging()
    logging.info("==========================================Program dimulai==========================================")
    
    # Inisialisasi database manager
    db_manager = DatabaseManager(
        "https://jsitzrpjtdorcdxencxm.supabase.co", 
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzaXR6cnBqdGRvcmNkeGVuY3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNjQ5MjEyOSwiZXhwIjoyMDQyMDY4MTI5fQ.tk5zgD7dv-LKae93N2c6Dj3cFSHtEhJYL772QeT7CIQ"
    )
    
    # Ambil konfigurasi
    config = db_manager.get_config()
    status_chat = db_manager.get_chat_status()
    
    if not config:
        logging.warning("Data konfigurasi chatbot tidak ditemukan.")
        return
        
    # Inisialisasi API service
    api_service = ApiService()
    
    # Inisialisasi chatbot
    chatbot = Chatbot(
        db_manager,
        api_service,
        config.get('openai_api'),
        config.get('openai_model'),
        config.get('openai_temperature'),
        config.get('openai_prompt')
    )
    
    # Inisialisasi chat manager
    chat_manager = ChatManager(db_manager, api_service, chatbot, status_chat)
    
    # Jalankan proses order
    api_service.jalankan_proses_order()
    
    # Proses semua chat
    chat_manager.process_all_chats()
    
    logging.info("==========================================Program selesai==========================================")

if __name__ == "__main__":
    print("Mulai menjalankan program...")
    main()