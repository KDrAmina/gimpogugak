'use client'

import { useEffect, useState } from 'react'

export default function SecretPage() {
  const [msg, setMsg] = useState('설정 중입니다... ⏳')

  useEffect(() => {
    // 👇 접속하자마자 이 코드가 실행됩니다!
    if (typeof window !== 'undefined') {
      localStorage.setItem('va-disable', 'true')
      setMsg('✅ 주인장 인증 완료! (통계 집계 제외됨)')
    }
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-5">
      <h1 className="text-3xl font-bold mb-4">🕵️‍♂️ 시크릿 설정</h1>
      <div className="bg-green-600 p-6 rounded-xl shadow-lg text-center">
        <p className="text-xl font-bold">{msg}</p>
      </div>
      <p className="mt-8 text-gray-400 text-sm">
        이제 창을 닫고 다른 페이지를 이용하세요.
        <br />
        (이 브라우저에서는 더 이상 방문자 수가 올라가지 않습니다.)
      </p>
    </div>
  )
}