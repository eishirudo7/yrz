'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LockIcon, UserIcon, MailIcon } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import logindark from '@/app/fonts/logod.png'
import loginlight from '@/app/fonts/logol.png'
import { useTheme } from 'next-themes'
import Image from 'next/image'

export default function StylishLoginPage() {
  const router = useRouter()
  const [loginData, setLoginData] = useState({
    email: '',
    password: '',
  })
  const [signupData, setSignupData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [loginError, setLoginError] = useState<string | null>(null)
  const [signupError, setSignupError] = useState<string | null>(null)
  const [signupSuccess, setSignupSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { theme } = useTheme()
  const supabase = createClient()

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setLoginData(prev => ({
      ...prev,
      [e.target.name]: value
    }))
  }

  const handleSignupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setSignupData(prev => ({
      ...prev,
      [e.target.name]: value
    }))
  }

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!loginData.email || !loginData.password) {
      setLoginError('Silakan isi semua kolom')
      return
    }
    
    setLoading(true)
    setLoginError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      })

      if (error) {
        setLoginError(error.message)
        return
      }

      router.push('/')
      router.refresh()

    } catch (error) {
      console.error('Login error:', error)
      setLoginError('Terjadi kesalahan sistem')
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (!signupData.email || !signupData.password || !signupData.confirmPassword) {
      setSignupError('Silakan isi semua kolom')
      return
    }

    if (signupData.password !== signupData.confirmPassword) {
      setSignupError('Password tidak cocok')
      return
    }

    if (signupData.password.length < 6) {
      setSignupError('Password minimal 6 karakter')
      return
    }
    
    setLoading(true)
    setSignupError(null)
    setSignupSuccess(null)

    try {
      const { error } = await supabase.auth.signUp({
        email: signupData.email,
        password: signupData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })

      if (error) {
        setSignupError(error.message)
        return
      }

      setSignupSuccess('Pendaftaran berhasil! Silakan cek email Anda untuk konfirmasi')
      setSignupData({
        email: '',
        password: '',
        confirmPassword: '',
      })
    } catch (error) {
      console.error('Signup error:', error)
      setSignupError('Terjadi kesalahan sistem')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-br from-gray-100 via-white to-gray-100 dark:from-gray-900 dark:via-blue-950 dark:to-gray-900 p-4">
      <div className="mb-8">
        <Image
          src={theme === 'dark' ? loginlight : logindark}
          alt="Logo"
          width={100}
          height={100}
          priority
          className="h-auto w-auto"
        />
      </div>
      
      <Card className="w-full max-w-md shadow-2xl backdrop-blur-sm bg-gray-50/90 dark:bg-black/50">
        <CardHeader className="space-y-1 pb-2">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white">Login System</h2>
          <p className="text-sm text-gray-700 dark:text-muted-foreground text-center">Selamat datang di Yorozuya</p>
        </CardHeader>
        
        <Tabs defaultValue="login" className="w-full">
          <div className="px-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Daftar</TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="login" className="pt-2">
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                {loginError && (
                  <Alert variant="destructive">
                    <AlertDescription>{loginError}</AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="email" className="sr-only">Email</Label>
                  <div className="relative">
                    <MailIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={loginData.email}
                      onChange={handleLoginChange}
                      placeholder="Email"
                      className="pl-10"
                      autoComplete="email"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="sr-only">Password</Label>
                  <div className="relative">
                    <LockIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      required
                      value={loginData.password}
                      onChange={handleLoginChange}
                      placeholder="Password"
                      className="pl-10"
                      autoComplete="current-password"
                      disabled={loading}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full font-semibold"
                  disabled={loading}
                >
                  {loading ? 'Memproses...' : 'Login'}
                </Button>
              </form>
            </CardContent>
          </TabsContent>
          
          <TabsContent value="signup" className="pt-2">
            <CardContent>
              <form onSubmit={handleSignup} className="space-y-4">
                {signupError && (
                  <Alert variant="destructive">
                    <AlertDescription>{signupError}</AlertDescription>
                  </Alert>
                )}
                
                {signupSuccess && (
                  <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-900">
                    <AlertDescription className="text-green-800 dark:text-green-300">{signupSuccess}</AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="sr-only">Email</Label>
                  <div className="relative">
                    <MailIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      required
                      value={signupData.email}
                      onChange={handleSignupChange}
                      placeholder="Email"
                      className="pl-10"
                      autoComplete="email"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="sr-only">Password</Label>
                  <div className="relative">
                    <LockIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      id="signup-password"
                      name="password"
                      type="password"
                      required
                      value={signupData.password}
                      onChange={handleSignupChange}
                      placeholder="Password"
                      className="pl-10"
                      autoComplete="new-password"
                      disabled={loading}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="sr-only">Konfirmasi Password</Label>
                  <div className="relative">
                    <LockIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      id="confirm-password"
                      name="confirmPassword"
                      type="password"
                      required
                      value={signupData.confirmPassword}
                      onChange={handleSignupChange}
                      placeholder="Konfirmasi Password"
                      className="pl-10"
                      autoComplete="new-password"
                      disabled={loading}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full font-semibold"
                  disabled={loading}
                >
                  {loading ? 'Memproses...' : 'Daftar'}
                </Button>
              </form>
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  )
}
