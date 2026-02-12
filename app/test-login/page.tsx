'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { useRouter } from 'next/navigation'

// ⚠️ 본인의 Supabase 키를 여기에 넣으셨죠? 그대로 두시면 됩니다!
const supabase = createClient(
  'https://zvwukvwtunqfptanctuc.supabase.co',
  'sb_publishable_C_P-C1Bj_brh2ni-7L1RJA_BmQwJNyk'
)

export default function TestLoginPage() {
  const router = useRouter()
  // 👇 서버에서는 빈 값, 브라우저에서만 주소를 가져오도록 변수 설정
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    // 이 코드는 브라우저에서만 실행되므로 안전합니다.
    setOrigin(window.location.origin)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        router.push('/members')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="bg-white w-full max-w-md p-8 rounded-xl shadow-lg border border-gray-100">
        <h1 className="text-2xl font-bold text-center mb-6">협회 로그인</h1>
        
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={['google', 'kakao']}
          // 👇 여기가 수정되었습니다! (window 직접 사용 금지 🚫)
          redirectTo={`${origin}/members`} 
        />
      </div>
    </div>
  )
}