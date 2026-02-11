'use client'

import { useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { useRouter } from 'next/navigation' // 👈 이동 기능 추가
import { Metadata } from 'next' // 👈 맨 위에 이거 추가

// 👇 이 코드를 컴포넌트(export default function...) 위에 붙여넣으세요
export const metadata: Metadata = {
  title: '로그인 테스트 (비공개)',
  robots: {
    index: false, // 구글아, 이 페이지는 검색에 띄우지 마!
    follow: false, // 이 페이지에 있는 링크도 따라가지 마!
  },
}
// Supabase 키 입력
const supabase = createClient(
  'https://zvwukvwtunqfptanctuc.supabase.co',
  'sb_publishable_C_P-C1Bj_brh2ni-7L1RJA_BmQwJNyk'
)

export default function TestLoginPage() {
  const router = useRouter()

  // 👇 로그인 상태 감시하다가, 로그인되면 납치해서 이동시키는 코드
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        // "어? 로그인했네? 회원방으로 가라!"
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
          // 이미 로그인된 사람은 입력창 안 보여주고 바로 이동시킴
          redirectTo={`${window.location.origin}/members`} 
        />
      </div>
    </div>
  )
}