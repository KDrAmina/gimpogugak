'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

// Supabase 설정 (아까랑 똑같이 키 넣어주세요!)
const supabase = createClient(
  'https://zvwukvwtunqfptanctuc.supabase.co',
  'sb_publishable_C_P-C1Bj_brh2ni-7L1RJA_BmQwJNyk'
)

export default function MembersPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    // 1. 현재 로그인한 사람이 있는지 확인
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        // 2. 로그인 안 했으면? -> "나가!" (로그인 페이지로 쫓아냄)
        alert("회원만 접근할 수 있습니다.")
        router.push('/test-login')
      } else {
        // 3. 로그인 했으면? -> 통과!
        setUser(user)
      }
    }
    checkUser()
  }, [router])

  // 로딩 중일 때 깜빡임 방지
  if (!user) return <div className="p-10 text-center">보안 검사 중...👮‍♂️</div>

  return (
    <div className="max-w-4xl mx-auto p-10">
      <h1 className="text-3xl font-bold mb-4">🤫 쉿! 회원 전용 게시판</h1>
      <p className="text-xl mb-8">환영합니다, <span className="text-blue-600 font-bold">{user.email}</span>님!</p>
      
      <div className="bg-yellow-100 p-6 rounded-lg border border-yellow-300">
        <h2 className="font-bold text-lg mb-2">🔒 대외비 자료</h2>
        <p>이 내용은 로그인한 회원에게만 보입니다.</p>
        <ul className="list-disc ml-5 mt-4 space-y-2">
          <li>협회 총회 회의록 (다운로드)</li>
          <li>회원 명부 전체 보기</li>
          <li>비공개 행사 일정</li>
        </ul>
      </div>

      <button 
        onClick={async () => {
          await supabase.auth.signOut()
          router.push('/test-login')
        }}
        className="mt-8 bg-gray-800 text-white px-6 py-2 rounded hover:bg-black"
      >
        로그아웃
      </button>
    </div>
  )
}