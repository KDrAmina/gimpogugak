import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "개인정보처리방침 | 김포국악원",
  description: "김포국악원 개인정보처리방침 — 수집 항목, 이용 목적, 보유 기간, 파기 절차 등을 안내합니다.",
};

const LAST_UPDATED = "2026년 02월 26일";

export default function PrivacyPage() {
  return (
    <div className="py-12 sm:py-16 px-4">
      <div className="max-w-3xl mx-auto">
        {/* 헤더 */}
        <h1 className="font-serif text-3xl text-ink font-semibold">개인정보처리방침</h1>
        <p className="mt-2 text-sm text-ink/50">시행일: {LAST_UPDATED}</p>

        <p className="mt-6 text-base text-ink/80 leading-relaxed">
          김포국악원(이하 &quot;본원&quot;)은 이용자의 개인정보를 소중히 여기며,
          「개인정보 보호법」 및 관련 법령을 준수합니다. 본 방침은 본원이 운영하는
          웹사이트(이하 &quot;사이트&quot;)에서 수집·이용·보관되는 개인정보에 관한 사항을
          규정합니다.
        </p>

        <div className="mt-10 space-y-10">
          {/* 1 */}
          <section>
            <h2 className="font-serif text-xl text-ink font-semibold mb-4">
              1. 수집하는 개인정보 항목
            </h2>
            <p className="text-sm text-ink/70 leading-relaxed mb-3">
              본원은 상담 신청, 수강 문의, 회원가입 등의 서비스 제공을 위해 아래와 같은
              최소한의 개인정보를 수집합니다.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-ink/5">
                    <th className="border border-ink/20 px-4 py-2 text-left font-semibold text-ink/80">수집 경로</th>
                    <th className="border border-ink/20 px-4 py-2 text-left font-semibold text-ink/80">수집 항목</th>
                  </tr>
                </thead>
                <tbody className="text-ink/70">
                  <tr>
                    <td className="border border-ink/20 px-4 py-2">상담·문의 신청</td>
                    <td className="border border-ink/20 px-4 py-2">이름, 연락처(전화번호), 문의 내용</td>
                  </tr>
                  <tr className="bg-ink/5">
                    <td className="border border-ink/20 px-4 py-2">수강 등록</td>
                    <td className="border border-ink/20 px-4 py-2">이름, 연락처, 이메일(선택), 수강 과목</td>
                  </tr>
                  <tr>
                    <td className="border border-ink/20 px-4 py-2">회원 가입</td>
                    <td className="border border-ink/20 px-4 py-2">이름, 이메일 주소, 비밀번호(암호화 저장), 연락처</td>
                  </tr>
                  <tr className="bg-ink/5">
                    <td className="border border-ink/20 px-4 py-2">서비스 이용 시 자동 수집</td>
                    <td className="border border-ink/20 px-4 py-2">접속 IP, 쿠키, 브라우저 유형, 방문 일시</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-ink/50">
              ※ 만 14세 미만 아동의 개인정보는 법정대리인의 동의 없이 수집하지 않습니다.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="font-serif text-xl text-ink font-semibold mb-4">
              2. 수집 및 이용 목적
            </h2>
            <ul className="list-disc list-inside space-y-1.5 text-sm text-ink/70 leading-relaxed">
              <li>수강 상담 및 문의에 대한 답변 제공</li>
              <li>수강 등록·관리 및 수업 안내</li>
              <li>수강료 납부 안내 및 결제 확인</li>
              <li>공지사항 및 행사·프로그램 정보 제공</li>
              <li>불법·부정 이용 방지 및 서비스 보안 유지</li>
              <li>법령상 의무 이행 및 분쟁 해결</li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="font-serif text-xl text-ink font-semibold mb-4">
              3. 보유 및 이용 기간
            </h2>
            <p className="text-sm text-ink/70 leading-relaxed mb-3">
              수집된 개인정보는 이용 목적이 달성되거나 동의 철회 시 지체 없이 파기합니다.
              단, 관련 법령에 따라 아래 기간 동안 보유할 수 있습니다.
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-sm text-ink/70 leading-relaxed">
              <li>수강 등록 및 계약 관련 기록: 계약 종료 후 <strong>5년</strong> (전자상거래법)</li>
              <li>소비자 불만·분쟁 처리 기록: <strong>3년</strong> (전자상거래법)</li>
              <li>로그인 기록 및 접속 기록: <strong>3개월</strong> (통신비밀보호법)</li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="font-serif text-xl text-ink font-semibold mb-4">
              4. 개인정보의 파기 절차 및 방법
            </h2>
            <p className="text-sm text-ink/70 leading-relaxed mb-3">
              보유 기간이 경과하거나 처리 목적이 달성된 개인정보는 다음의 방법으로 파기합니다.
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-sm text-ink/70 leading-relaxed">
              <li>
                <strong>전자적 파일:</strong> 복구 불가능한 방법으로 영구 삭제
              </li>
              <li>
                <strong>종이 문서:</strong> 분쇄기로 파쇄 또는 소각
              </li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="font-serif text-xl text-ink font-semibold mb-4">
              5. 개인정보의 제3자 제공
            </h2>
            <p className="text-sm text-ink/70 leading-relaxed">
              본원은 이용자의 개인정보를 원칙적으로 제3자에게 제공하지 않습니다.
              다만, 다음의 경우에는 예외로 합니다.
            </p>
            <ul className="list-disc list-inside mt-3 space-y-1.5 text-sm text-ink/70 leading-relaxed">
              <li>이용자가 사전에 동의한 경우</li>
              <li>법령에 의하여 요구되는 경우 (수사기관 등)</li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="font-serif text-xl text-ink font-semibold mb-4">
              6. 이용자 및 법정대리인의 권리
            </h2>
            <p className="text-sm text-ink/70 leading-relaxed mb-3">
              이용자(또는 법정대리인)는 아래의 권리를 언제든지 행사할 수 있습니다.
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-sm text-ink/70 leading-relaxed">
              <li>개인정보 열람 요청</li>
              <li>오류 정정 요청</li>
              <li>삭제 요청</li>
              <li>처리 정지 요청</li>
            </ul>
            <p className="mt-3 text-sm text-ink/70 leading-relaxed">
              권리 행사는 아래 개인정보 보호책임자에게 서면, 전화 또는 이메일로 요청하시면
              지체 없이 처리하겠습니다.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="font-serif text-xl text-ink font-semibold mb-4">
              7. 개인정보 보호책임자
            </h2>
            <div className="bg-ink/5 rounded-lg px-5 py-4 text-sm text-ink/75 space-y-1.5">
              <p><span className="font-semibold text-ink/90">기관명:</span> 김포국악원</p>
              <p><span className="font-semibold text-ink/90">책임자:</span> 원장</p>
              <p>
                <span className="font-semibold text-ink/90">연락처:</span>{" "}
                <a href="tel:0316280909" className="underline hover:text-ink">
                  031-628-0909
                </a>
              </p>
              <p>
                <span className="font-semibold text-ink/90">주소:</span>{" "}
                경기도 김포시
              </p>
            </div>
            <p className="mt-3 text-xs text-ink/50">
              개인정보 침해에 관한 신고·상담은 개인정보보호위원회(privacy.go.kr, 국번없이 182) 또는
              한국인터넷진흥원(kisa.or.kr, 118)에도 문의하실 수 있습니다.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="font-serif text-xl text-ink font-semibold mb-4">
              8. 쿠키 운영 및 거부
            </h2>
            <p className="text-sm text-ink/70 leading-relaxed">
              본원 사이트는 서비스 개선 및 이용자 편의를 위해 쿠키를 사용할 수 있습니다.
              쿠키는 브라우저 설정에서 언제든지 거부하거나 삭제할 수 있으며, 거부 시 일부 서비스
              이용이 제한될 수 있습니다.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="font-serif text-xl text-ink font-semibold mb-4">
              9. 개인정보처리방침의 변경
            </h2>
            <p className="text-sm text-ink/70 leading-relaxed">
              본 방침은 법령·정책 또는 서비스 변경에 따라 개정될 수 있으며, 변경 시 사이트
              공지사항을 통해 사전 안내합니다. 개정된 방침은 공지 후 7일이 경과한 날부터
              효력이 발생합니다.
            </p>
          </section>
        </div>

        {/* 하단 네비게이션 */}
        <div className="mt-12 pt-8 border-t border-ink/10 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-ink/20 text-sm text-ink/70 hover:bg-ink/5 transition-colors"
          >
            ← 홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
