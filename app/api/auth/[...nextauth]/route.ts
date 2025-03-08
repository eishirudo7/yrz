import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { headers } from 'next/headers'

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (
          credentials?.username === process.env.ADMIN_USERNAME && 
          credentials?.password === process.env.ADMIN_PASSWORD
        ) {
          return {
            id: "1",
            name: "Admin",
            email: process.env.ADMIN_USERNAME
          }
        }
        return null
      }
    })
  ],
  callbacks: {
    redirect({ url, baseUrl }) {
      const requestHost = headers().get("host") || "";
      const dynamicBaseUrl = `${headers().get("x-forwarded-proto") || "https"}://${requestHost}`;
      
      if (url.startsWith("http")) return url;
      if (url.startsWith("/")) return `${dynamicBaseUrl}${url}`;
      return dynamicBaseUrl;
    },
  },
  pages: {
    signIn: '/login',
    signOut: '/login',
    error: '/login',
  },
  session: {
    strategy: "jwt",
  },
})

export { handler as GET, handler as POST }