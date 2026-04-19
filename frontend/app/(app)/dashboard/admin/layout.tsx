"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser } from "@/lib/user"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    async function checkAdmin() {
      try {
        const user = await getCurrentUser()
        if (user.role !== "ADMIN") {
          router.replace("/login")
          return
        }
        setAuthorized(true)
      } catch {
        router.replace("/login")
      }
    }
    checkAdmin()
  }, [router])

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#06070C]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <main className="p-6">{children}</main>
    </div>
  )
}
