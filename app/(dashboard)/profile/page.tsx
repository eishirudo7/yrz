// app/(dashboard)/profile/page.tsx
'use client'

import { useUserData } from '@/contexts/UserDataContext';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { CrownIcon, UserIcon, StoreIcon, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";

export default function ProfilePage() {
  const { userId, subscription, shops, isLoading, refreshData } = useUserData();
  const [userDetails, setUserDetails] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const router = useRouter();
  
  useEffect(() => {
    async function loadUserDetails() {
      try {
        const response = await fetch('/api/profile');
        const data = await response.json();
        
        if (data.success) {
          setUserDetails(data.data);
        } else {
          console.error('Error loading user details:', data.message);
        }
      } catch (error) {
        console.error('Failed to load user details:', error);
      } finally {
        setLoadingUser(false);
      }
    }
    
    loadUserDetails();
  }, [userId]);
  
  // Format tanggal
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };
  
  // Hitung sisa hari
  const getRemainingDays = (endDate: string | null) => {
    if (!endDate) return null;
    
    const end = new Date(endDate);
    const today = new Date();
    
    end.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 0 ? diffDays : 0;
  };

  // Hitung persentase hari tersisa
  const getRemainingPercentage = (startDate: string | null, endDate: string | null) => {
    if (!startDate || !endDate) return 0;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysElapsed < 0) return 100;
    if (daysElapsed > totalDays) return 0;
    
    return Math.max(0, Math.min(100, 100 - (daysElapsed / totalDays * 100)));
  };
  
  return (
    <div className="container px-4 py-6 max-w-5xl">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Profil dan Langganan</h1>
          <p className="text-muted-foreground text-sm mt-1">Informasi akun dan paket langganan</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refreshData}>
            Muat Ulang
          </Button>
          <Button size="sm" onClick={() => router.push('/pengaturan/subscription')}>
            Kelola Langganan
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="subscription">Langganan</TabsTrigger>
          <TabsTrigger value="shops">Toko</TabsTrigger>
        </TabsList>
        
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border">
                  <AvatarImage src={userDetails?.profile_image || ''} alt={userDetails?.name || 'User'} />
                  <AvatarFallback className="text-xl">
                    {userDetails?.name?.[0]?.toUpperCase() || userDetails?.email?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle>{userDetails?.name || 'Pengguna'}</CardTitle>
                  <CardDescription className="flex items-center gap-1 mt-1">
                    {userDetails?.email_verified ? (
                      <span className="flex items-center text-green-500">
                        <ShieldCheck size={12} className="mr-1" />
                        Terverifikasi
                      </span>
                    ) : (
                      <span className="flex items-center text-amber-500">
                        Belum Terverifikasi
                      </span>
                    )}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loadingUser ? (
                  <>
                    <Skeleton className="h-4 w-full mb-4" />
                    <Skeleton className="h-4 w-3/4 mb-4" />
                    <Skeleton className="h-4 w-1/2" />
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Email</p>
                      <p>{userDetails?.email || 'Tidak diketahui'}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">No. Handphone</p>
                      <p>{userDetails?.phone || 'Belum diatur'}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Terdaftar Sejak</p>
                      <p>{userDetails?.created_at ? formatDate(userDetails.created_at) : '-'}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Status Verifikasi</p>
                      <Badge variant={userDetails?.email_verified ? "success" : "destructive"}>
                        {userDetails?.email_verified ? "Email Terverifikasi" : "Email Belum Diverifikasi"}
                      </Badge>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <Button variant="outline" size="sm" onClick={() => router.push('/pengaturan/profile/edit')}>
                Edit Profil
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="subscription" className="space-y-4">
          <Card className={subscription ? 'border-primary/20' : ''}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <CrownIcon className="h-5 w-5" />
                  Status Langganan
                </CardTitle>
                
                {subscription && (
                  <Badge className={`${
                    subscription.plan_name === 'free' ? 'bg-gray-500' :
                    subscription.plan_name === 'basic' ? 'bg-blue-500' :
                    subscription.plan_name === 'premium' ? 'bg-purple-500' :
                    'bg-amber-500'
                  }`}>
                    {subscription.plan_name.toUpperCase()}
                  </Badge>
                )}
              </div>
            </CardHeader>
            
            <Separator />
            
            <CardContent className="pt-4">
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-2" />
                </div>
              ) : subscription ? (
                <div className="space-y-6">
                  {/* Progress bar untuk masa langganan */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Masa Berlaku</span>
                      {subscription.end_date && getRemainingDays(subscription.end_date) !== null && (
                        <Badge variant={getRemainingDays(subscription.end_date)! < 7 ? "destructive" : "outline"}>
                          {getRemainingDays(subscription.end_date)} hari tersisa
                        </Badge>
                      )}
                    </div>
                    
                    <Progress value={getRemainingPercentage(subscription.start_date, subscription.end_date)} className="h-2" />
                    
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatDate(subscription.start_date)}</span>
                      <span>{formatDate(subscription.end_date)}</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-lg border p-3 bg-background">
                      <h4 className="text-sm font-medium mb-2">Detail Paket</h4>
                      
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Status</p>
                          <p className="text-sm">{subscription.status === 'active' ? 'Aktif' : 'Tidak Aktif'}</p>
                        </div>
                        
                        <div>
                          <p className="text-xs text-muted-foreground">Batas Toko</p>
                          <div className="flex items-center gap-2">
                            <p className="text-sm">{shops.length} / {subscription.max_shops}</p>
                            {shops.length >= subscription.max_shops && (
                              <Badge variant="destructive" className="text-xs">Penuh</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="rounded-lg border p-3 bg-background">
                      <h4 className="text-sm font-medium mb-2">Fitur Paket</h4>
                      
                      {subscription.features && subscription.features.length > 0 ? (
                        <div className="space-y-1">
                          {subscription.features.slice(0, 4).map((feature, index) => (
                            <div key={index} className="flex items-start">
                              <CheckCircle2 className="h-3 w-3 text-green-500 mr-1 mt-0.5" />
                              <p className="text-xs">{feature}</p>
                            </div>
                          ))}
                          {subscription.features.length > 4 && (
                            <p className="text-xs text-muted-foreground ml-4">+{subscription.features.length - 4} fitur lainnya</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Tidak ada fitur tambahan</p>
                      )}
                    </div>
                  </div>
                  
                  {subscription.plan_name === 'free' && (
                    <div className="rounded-lg border bg-muted/40 p-3 flex flex-col md:flex-row items-center justify-between gap-3">
                      <p className="text-sm">Tingkatkan ke paket berbayar untuk fitur lebih banyak</p>
                      <Button size="sm" className="whitespace-nowrap" onClick={() => router.push('/pengaturan/subscription')}>
                        Upgrade Sekarang
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <CrownIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <h3 className="text-lg font-medium mb-1">Anda belum berlangganan</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                    Tingkatkan ke paket langganan untuk mendapatkan fitur lengkap
                  </p>
                  <Button size="sm" onClick={() => router.push('/pengaturan/subscription')}>
                    Lihat Paket Langganan
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="shops" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <StoreIcon className="h-5 w-5" />
                  Toko Terhubung
                </CardTitle>
                
                {subscription && shops.length < subscription.max_shops && (
                  <Button size="sm" onClick={() => router.push('/pengaturan/shops/connect')}>
                    <StoreIcon className="mr-1 h-4 w-4" />
                    Tambah Toko
                  </Button>
                )}
              </div>
            </CardHeader>
            
            <Separator />
            
            <CardContent className="pt-4">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : shops.length > 0 ? (
                <div className="rounded-lg border divide-y">
                  {shops.map((shop) => (
                    <div key={shop.id} className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8 bg-primary/10">
                          <AvatarFallback className="text-xs text-primary">
                            {shop.shop_name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <p className="font-medium text-sm">{shop.shop_name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={shop.is_active ? "success" : "destructive"} className="text-xs">
                          {shop.is_active ? "Aktif" : "Nonaktif"}
                        </Badge>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 px-2"
                          onClick={() => router.push(`/pengaturan/shops/edit/${shop.shop_id}`)}
                        >
                          Kelola
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 border rounded-lg">
                  <StoreIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <h3 className="text-base font-medium mb-1">Belum ada toko</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Hubungkan toko untuk mulai menggunakan aplikasi
                  </p>
                  <Button size="sm" onClick={() => router.push('/pengaturan/shops/connect')}>
                    Hubungkan Toko
                  </Button>
                </div>
              )}
            </CardContent>
            
            {shops.length > 0 && (
              <CardFooter className="border-t pt-3">
                <Button variant="outline" size="sm" onClick={() => router.push('/pengaturan/shops')}>
                  Kelola Semua Toko
                </Button>
              </CardFooter>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}