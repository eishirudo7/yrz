'use client'

import { useState, useEffect } from "react"
import { useTheme } from "next-themes" // Import useTheme
import { CircleUser, Search, Menu, Sun, Moon, Bell, AlertCircle, CheckCircle, AlertTriangle, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { signOut, useSession } from "next-auth/react" // Tambahkan import ini
import { useSSE } from "@/app/services/SSEService"

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MobileSidebar } from "./mobile-sidebar"
import Image from "next/image"
import logoGelap from "@/app/fonts/logogelap.png"
import logoTerang from "@/app/fonts/logoterang.png"
import Link from "next/link" // Import Link dari next/link
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Notification {
  id: number
  type: 'shop_penalty' | 'shopee_update' | 'item_violation'
  action: string
  shop_id: number
  shop_name: string
  details: any
  timestamp: number
  read: boolean
  title?: string
  content?: string
  url?: string
}

interface HealthCheckData {
  success: boolean;
  data: {
    shop_health: {
      flashSaleIssues: Array<{
        shop_id: number;
        shop_name: string;
        issues: {
          inactive_current: number;
          no_active_flashsale: boolean;
          upcoming_count: number;
          inactive_upcoming: number;
        };
        details: Array<any>;
      }>;
      discountIssues: {
        shops_without_backup: Array<{
          shop_name: string;
          shop_id: number;
          ongoing_discounts: Array<{
            discount_id: number;
            discount_name: string;
            start_time_formatted: string;
            end_time_formatted: string;
            status: string;
          }>;
        }>;
        ending_soon: Array<any>;
        expired_without_ongoing: Array<any>;
      };
      returnIssues: Array<{
        return_sn: string;
        order_sn: string;
        reason: string;
        text_reason: string;
        create_time: number;
        status: string;
        return_solution: number;
        refund_amount: number;
        user: {
          username: string;
          email: string;
        };
        item: Array<{
          name: string;
          item_sku: string;
          amount: number;
          refund_amount: number;
        }>;
      }>;
      summary: {
        totalIssues: number;
        criticalShops: Array<{
          shop_id: number;
          shop_name: string;
          issues: string[];
          details: Array<{
            flash_sale_id: number;
            start_time: number;
            end_time: number;
            type: string;
          }>;
        }>;
      };
    };
    openai: {
      success: boolean;
      message?: string;
    };
  };
  message: string;
}

const HEALTH_CHECK_INTERVAL = 30 * 60 * 1000; // 30 menit dalam milliseconds
const LAST_HEALTH_CHECK_KEY = 'last_health_check';

export function Header() {

  const [isMobile, setIsMobile] = useState(false)
  const { theme, setTheme } = useTheme()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const { lastMessage } = useSSE()
  const [healthData, setHealthData] = useState<HealthCheckData | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [expandedShop, setExpandedShop] = useState<number | null>(null);

  useEffect(() => {
    if (!lastMessage) return
    
    if (['shop_penalty', 'shopee_update', 'item_violation'].includes(lastMessage.type)) {
      setNotifications(prev => [{
        id: lastMessage.id,
        type: lastMessage.type,
        action: lastMessage.action,
        shop_id: lastMessage.shop_id,
        shop_name: lastMessage.shop_name,
        details: lastMessage.details,
        timestamp: lastMessage.timestamp,
        read: false,
        title: lastMessage.title,
        content: lastMessage.content,
        url: lastMessage.url
      }, ...prev])
    }
  }, [lastMessage])

  useEffect(() => {
    fetchNotifications()
  }, [])

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkIsMobile()
    window.addEventListener('resize', checkIsMobile)

    return () => window.removeEventListener('resize', checkIsMobile)
  }, [])

  const shouldFetchHealthCheck = () => {
    const lastCheck = localStorage.getItem(LAST_HEALTH_CHECK_KEY);
    if (!lastCheck) return true;

    const timeSinceLastCheck = Date.now() - parseInt(lastCheck);
    return timeSinceLastCheck > HEALTH_CHECK_INTERVAL;
  };

  const fetchHealthCheck = async (force = false) => {
    try {
      if (!force && !shouldFetchHealthCheck()) {
        const cachedData = localStorage.getItem('health_check_data');
        if (cachedData) {
          setHealthData(JSON.parse(cachedData));
          return;
        }
      }

      setLoadingHealth(true);
      const response = await fetch('/api/health');
      const data = await response.json();
      setHealthData(data);
      
      // Simpan data dan timestamp
      localStorage.setItem('health_check_data', JSON.stringify(data));
      localStorage.setItem(LAST_HEALTH_CHECK_KEY, Date.now().toString());
    } catch (error) {
      console.error('Error fetching health check:', error);
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    fetchHealthCheck();
  }, []);

  // Fungsi-fungsi handler
  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/notifications?unread_only=true')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setNotifications(data)
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleNotificationClick = async (notificationId: number) => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_ids: [notificationId] })
      })
      
      // Refresh notifications
      fetchNotifications()
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const notificationIds = notifications.map(n => n.id)
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_ids: notificationIds })
      })
      
      // Refresh notifications
      fetchNotifications()
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  const handleLogout = async () => {
    try {
      await signOut({ 
        redirect: true,
        callbackUrl: "/login"
      })
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <header className="flex h-[53px] items-center justify-between gap-4 border-b bg-muted/40 px-4 lg:px-6">
      <div className="w-[60px]">
        {isMobile && <MobileSidebar onNavigate={() => {}} />}
      </div>
      <div className="flex-1 flex justify-center">
        <Link href="/">
          <Image
            src={theme === 'dark' ? logoGelap : logoTerang}
            alt="Logo Perusahaan"
            width={120}
            height={40}
            className="w-auto h-auto"
          />
        </Link>
      </div>
      <div className="flex items-center gap-4 w-auto min-w-[60px]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full relative hover:bg-muted"
            >
              <Bell className="h-5 w-5" />
              {(notifications.length > 0 || (healthData?.data?.shop_health?.summary?.totalIssues ?? 0) > 0) && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] rounded-full w-4 h-4 flex items-center justify-center">
                  {notifications.length + (healthData?.data?.shop_health?.summary?.totalIssues ?? 0)}
                </span>
              )}
              <span className="sr-only">Notifikasi</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="w-[320px] md:w-[380px] md:right-0 translate-x-[10%]"
          >
            <Tabs defaultValue="notifications" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="notifications" className="flex-1">
                  <span className="flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    <span className="text-xs">Notifikasi</span>
                    {notifications.length > 0 && (
                      <span className="bg-red-500 text-white text-[8px] rounded-full w-4 h-4 flex items-center justify-center">
                        {notifications.length}
                      </span>
                    )}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="health" className="flex-1">
                  <span className="flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    <span className="text-xs">Health Check</span>
                    {healthData?.data?.shop_health?.summary?.totalIssues !== undefined && 
                     healthData?.data?.shop_health?.summary?.totalIssues > 0 && (
                      <span className="bg-yellow-500 text-white text-[8px] rounded-full w-4 h-4 flex items-center justify-center">
                        {healthData?.data?.shop_health?.summary?.totalIssues}
                      </span>
                    )}
                  </span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="notifications">
                <DropdownMenuLabel className="flex justify-between items-center border-b pb-2">
                  <span className="font-semibold">Notifikasi</span>
                  {notifications.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={markAllAsRead}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Tandai semua dibaca
                    </Button>
                  )}
                </DropdownMenuLabel>

                {notifications.length > 0 ? (
                  <div className="max-h-[400px] overflow-y-auto">
                    {notifications.map((notification) => (
                      <DropdownMenuItem 
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification.id)}
                        className="cursor-pointer p-4 hover:bg-muted/50 border-b last:border-b-0"
                      >
                        {notification.type === 'shopee_update' ? (
                          <div className="flex flex-col gap-2 w-full">
                            <div className="flex items-start gap-3">
                              <div className="mt-1 p-2 rounded-full bg-blue-100 text-blue-600">
                                <Bell className="h-4 w-4" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] text-muted-foreground">
                                    {notification.shop_name}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(notification.timestamp * 1000).toLocaleString('id-ID', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: '2-digit'
                                    }).replace(',', '')}
                                  </span>
                                </div>
                                <p className="font-medium text-sm">{notification?.title}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {notification?.content?.replace(/<\/?[^>]+(>|$)/g, "")}
                                </p>
                                {notification?.url && (
                                  <a 
                                    href={notification.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-2 inline-block text-xs text-blue-600 hover:underline"
                                  >
                                    Lihat detail
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : notification.type === 'shop_penalty' ? (
                          <div className="flex flex-col gap-2 w-full">
                            <div className="flex items-start gap-3">
                              <div className="mt-1 p-2 rounded-full bg-red-100 text-red-600">
                                <AlertCircle className="h-4 w-4" />
                              </div>
                              <div className="flex-1">
                                <span className="text-[10px] text-muted-foreground">
                                  {notification.shop_name}
                                </span>
                                <p className="font-medium text-sm">Penalti Toko</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {notification.details.points && `Poin: ${notification.details.points}`}
                                  {notification.details.violation_type && (
                                    <span className="block">Jenis: {notification.details.violation_type}</span>
                                  )}
                                  {notification.details.reason && (
                                    <span className="block">Alasan: {notification.details.reason}</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : notification.type === 'item_violation' ? (
                          <div className="flex flex-col gap-2 w-full">
                            <div className="flex items-start gap-3">
                              <div className="mt-1 p-2 rounded-full bg-yellow-100 text-yellow-600">
                                <AlertTriangle className="h-4 w-4" />
                              </div>
                              <div className="flex-1">
                                <span className="text-[10px] text-muted-foreground">
                                  {notification.shop_name}
                                </span>
                                <p className="font-medium text-sm">Pelanggaran Produk</p>
                                <p className="mt-1 text-xs font-medium">
                                  {notification.details.item_name}
                                </p>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {notification.details.violations.map((v: any, i: number) => (
                                    <div key={i} className="mt-1">
                                      <span className="block">Jenis: {v.type}</span>
                                      <span className="block">Alasan: {v.reason}</span>
                                      {v.suggestion && (
                                        <span className="block">Saran: {v.suggestion}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Tidak ada notifikasi baru</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="health">
                <DropdownMenuLabel className="flex justify-between items-center border-b pb-2">
                  <span className="text-xs font-medium">Status Sistem</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => fetchHealthCheck(true)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Refresh
                  </Button>
                </DropdownMenuLabel>

                <div className="max-h-[400px] overflow-y-auto p-2">
                  {loadingHealth ? (
                    <div className="p-8 text-center">
                      <Activity className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3 animate-pulse" />
                      <p className="text-sm text-muted-foreground">Memuat status sistem...</p>
                    </div>
                  ) : healthData && healthData.data ? (
                    <div className="space-y-4">
                      {/* OpenAI Status */}
                      <div className="p-3 rounded-lg border">
                        <div className="flex items-center gap-2">
                          {healthData.data.openai?.success ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="text-xs">OpenAI Service</span>
                          {!healthData.data.openai?.success && (
                            <span className="text-[11px] text-red-600 ml-2">
                              {healthData.data.openai?.message}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Shop Health Issues */}
                      {healthData.data.shop_health?.summary?.criticalShops?.length > 0 ? (
                        <div className="space-y-3">
                          {/* Return Issues */}
                          {healthData.data.shop_health.returnIssues?.length > 0 && (
                            <div className="p-3 rounded-lg border">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                                <span className="text-xs font-medium">Return Kritis</span>
                              </div>
                              <div className="space-y-2">
                                {healthData.data.shop_health.returnIssues.map((returnIssue, index) => (
                                  <div key={index} className="text-xs space-y-1 border-t pt-2 first:border-t-0 first:pt-0">
                                    <div className="flex justify-between">
                                      <span className="font-medium">Return #{returnIssue.return_sn}</span>
                                      <span className="text-muted-foreground">
                                        {new Date(returnIssue.create_time * 1000).toLocaleDateString('id-ID')}
                                      </span>
                                    </div>
                                    <div className="text-muted-foreground">
                                      <p>Order: {returnIssue.order_sn}</p>
                                      <p>Status: {returnIssue.status}</p>
                                      <p>Alasan: {returnIssue.text_reason}</p>
                                      <p>Refund: Rp {returnIssue.refund_amount.toLocaleString('id-ID')}</p>
                                    </div>
                                    {returnIssue.item.map((item, itemIndex) => (
                                      <div key={itemIndex} className="ml-2 text-muted-foreground">
                                        <p>• {item.name}</p>
                                        <p className="ml-2">SKU: {item.item_sku}</p>
                                        <p className="ml-2">Jumlah: {item.amount}</p>
                                        <p className="ml-2">Refund: Rp {item.refund_amount.toLocaleString('id-ID')}</p>
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Existing Critical Shops */}
                          {healthData.data.shop_health.summary.criticalShops.map((shop, index) => (
                            <div 
                              key={index} 
                              className="p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => setExpandedShop(expandedShop === shop.shop_id ? null : shop.shop_id)}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                <span className="text-xs">{shop.shop_name}</span>
                              </div>
                              <ul className="space-y-1">
                                {shop.issues.map((issue, i) => (
                                  <li key={i} className="text-xs text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                                      {issue}
                                    </div>
                                    {issue === 'Tidak ada backup diskon' && expandedShop === shop.shop_id && (
                                      <div className="mt-1 ml-3 space-y-1">
                                        <p className="font-medium text-xs text-muted-foreground">Diskon aktif:</p>
                                        {healthData.data.shop_health.discountIssues.shops_without_backup
                                          .find(s => s.shop_id === shop.shop_id)
                                          ?.ongoing_discounts.map((discount, j) => (
                                            <p key={j} className="text-[11px] text-muted-foreground ml-2">
                                              • {discount.discount_name} ({discount.start_time_formatted} - {discount.end_time_formatted})
                                            </p>
                                          ))
                                        }
                                      </div>
                                    )}
                                    {(issue.includes('Flash Sale aktif tidak memiliki produk') || 
                                      issue.includes('Flash Sale mendatang tidak memiliki produk')) && 
                                     expandedShop === shop.shop_id && (
                                      <div className="mt-1 ml-3 space-y-1">
                                        <p className="font-medium text-xs text-muted-foreground">Detail Flash Sale:</p>
                                        {shop.details
                                          .filter(d => d.type === (issue.includes('aktif') ? 'current_inactive' : 'upcoming_inactive'))
                                          .map((detail, j) => (
                                            <p key={j} className="text-[11px] text-muted-foreground ml-2">
                                              • Flash Sale ID: {detail.flash_sale_id} ({new Date(detail.start_time * 1000).toLocaleString('id-ID')} - {new Date(detail.end_time * 1000).toLocaleString('id-ID')})
                                            </p>
                                          ))
                                        }
                                      </div>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-950/20">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-green-600 dark:text-green-400">Semua toko dalam kondisi baik</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <AlertCircle className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">Gagal memuat status sistem</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </DropdownMenuContent>
        </DropdownMenu>

        {!isMobile && (
          <Button 
            onClick={toggleTheme} 
            variant="ghost" 
            size="icon" 
            className="rounded-full hover:bg-muted"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        )}
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full hover:bg-muted"
            >
              <CircleUser className="h-5 w-5" />
              <span className="sr-only">Toggle user menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="flex items-center">
              My Account
              {isMobile && (
                <Button onClick={toggleTheme} variant="ghost" size="icon" className="ml-auto">
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/pengaturan">Pengaturan</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleLogout}
              className="text-red-600 focus:text-red-600 cursor-pointer"
            >
              Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
