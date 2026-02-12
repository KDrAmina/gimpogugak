'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  'https://zvwukvwtunqfptanctuc.supabase.co',
  'sb_publishable_C_P-C1Bj_brh2ni-7L1RJA_BmQwJNyk'
)

export default function TestLoginPage() {
  const router = useRouter()
  const [origin, setOrigin] = useState('')

  useEffect(() => {
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
        <h1 className="text-2xl font-bold text-center mb-6">김포국악원 회원 로그인</h1>
        
        <Auth
          supabaseClient={supabase}
          
          // 👇 1. 디자인 커스터마이징 (버튼 색상 변경)
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#1a1a1a', // 버튼 색깔 (진한 검정색)
                  brandAccent: '#333333', // 마우스 올렸을 때 색깔
                },
              },
            },
          }}

          // 👇 2. 한글 패치 (여기가 핵심입니다!)
          localization={{
            variables: {
              sign_in: {
                email_label: '이메일 주소',
                password_label: '비밀번호',
                email_input_placeholder: '이메일을 입력하세요',
                password_input_placeholder: '비밀번호를 입력하세요',
                button_label: '로그인하기',
                loading_button_label: '로그인 중...',
                social_provider_text: '{{provider}}로 시작하기', // 예: Google로 시작하기
                link_text: '로그인하기', // (회원가입 화면에서 돌아올 때 문구)
              },
              sign_up: {
                email_label: '이메일 주소',
                password_label: '비밀번호',
                email_input_placeholder: '이메일을 입력하세요',
                password_input_placeholder: '비밀번호를 입력하세요',
                button_label: '회원가입하기',
                loading_button_label: '가입 처리 중...',
                social_provider_text: '{{provider}}로 회원가입',
                link_text: '계정이 없으신가요? 회원가입',
              },
              forgotten_password: {
                email_label: '이메일 주소',
                password_label: '비밀번호',
                email_input_placeholder: '이메일을 입력하세요',
                button_label: '비밀번호 재설정 메일 보내기',
                link_text: '비밀번호를 잊으셨나요?',
              },
            },
          }}
          
          providers={['google', 'kakao']}
          redirectTo={`${origin}/members`} 
        />
      </div>
    </div>
  )
}