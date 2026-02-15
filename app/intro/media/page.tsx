import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "언론 보도 | 김포국악원 (Gimpo Gugak Center)",
  description:
    "김포신문 등 언론에서 소개한 김포국악원 기사와 박준열 부원장의 교육 칼럼.",
};

const BASE_URL = "https://www.igimpo.com/news/articleView.html";

/** 김포신문 일반 기사 - 제목/날짜는 나중에 쉽게 수정 가능 */
const GENERAL_NEWS: { url: string; title: string; date: string }[] = [




 
  { url: `${BASE_URL}?idxno=91076`, title: "시민이 만든 문화, 김포 곳곳에서 꽃피다", date: "25.12.02" },
  { url: `${BASE_URL}?idxno=89958`, title: "[인터뷰] 문도진 제16회 한음(국악) 꿈나무 경연대회 유치부 은상", date: "25.09.03" },
  { url: `${BASE_URL}?idxno=89280`, title: "[창간기획] 지역이 키우는 아이들 - 민요 배우며 자라는 아이들 ", date: "25.07.16" },
  { url: `${BASE_URL}?idxno=89105`, title: "[문화엿보기] 조강의 노래- 강과 사람의 이야기", date: "25.07.02" },
  { url: `${BASE_URL}?idxno=87494`, title: "김포아트빌리지 한옥마을에 놀러오세요!", date: "25.03.21" },
  { url: `${BASE_URL}?idxno=86152`, title: "[문화엿보기] 2024 김포아트빌리지 한옥마을 성과공유전시 '하모니'展]", date: "24.12.18" },
  { url: `${BASE_URL}?idxno=85975`, title: "김포문화재단, 겨울맞이 '윈터빌리지'등 문화행사 개최", date: "24.12.09" },
  {
    url: "https://www.gcf.or.kr/main/pst/view.do?pst_id=culture&pst_sn=3725",
    title: "제22회 전국서도소리경연대회, 김포국악원 참가자 전원 수상 쾌거",
    date: "24.09.05",
  },
  { url: `${BASE_URL}?idxno=82405`, title: "나는 나의 봄이다", date: "24.04.26" },
  { url: `${BASE_URL}?idxno=79522`, title: "김포국악원, '김포 옛 잡가를 만나다' 공연", date: "23.10.22" },
  { url: `${BASE_URL}?idxno=76828`, title: "예술가와 시민의 문화소통·체험공간, 송리결 명창의 '김포국악원'", date: "23.05.16" },
];

/** 박준열 부원장 교육 칼럼 */
const COLUMN_ITEMS: { url: string; title: string; date: string }[] = [
  { url: `${BASE_URL}?idxno=90054`, title: "박준열의 교육 칼럼 1편", date: "25.09.10" },
  { url: `${BASE_URL}?idxno=90256`, title: "박준열의 교육 칼럼 2편", date: "25.09.24" },
  { url: `${BASE_URL}?idxno=90463`, title: "박준열의 교육 칼럼 3편", date: "25.10.15" },
  { url: `${BASE_URL}?idxno=90630`, title: "박준열의 교육 칼럼 4편", date: "25.10.29" },
  { url: `${BASE_URL}?idxno=90819`, title: "박준열의 교육 칼럼 5편", date: "25.11.12" },
  { url: `${BASE_URL}?idxno=90990`, title: "박준열의 교육 칼럼 6편", date: "25.11.26" },
  { url: `${BASE_URL}?idxno=91144`, title: "박준열의 교육 칼럼 7편", date: "25.12.10" },
  { url: `${BASE_URL}?idxno=91302`, title: "박준열의 교육 칼럼 8편", date: "25.12.31" },
  { url: `${BASE_URL}?idxno=91499`, title: "박준열의 교육 칼럼 9편", date: "26.01.14" },
  { url: `${BASE_URL}?idxno=91717`, title: "박준열의 교육 칼럼 10편", date: "26.02.04" },
];

function DotLeaderItem({
  href,
  title,
  date,
}: {
  href: string;
  title: string;
  date: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-baseline gap-2 sm:gap-3 py-2 group"
    >
      <span className="truncate text-[#111] group-hover:text-blue-600 cursor-pointer transition-colors min-w-0 flex-1 sm:flex-initial">
        {title}
      </span>
      <span
        className="hidden sm:block flex-1 min-w-[20px] border-b-2 border-dotted border-gray-300 self-end mb-1 mx-2 shrink-0"
        aria-hidden
      />
      <span className="text-sm text-gray-500 whitespace-nowrap shrink-0">{date}</span>
    </a>
  );
}

function MediaList({ items }: { items: { url: string; title: string; date: string }[] }) {
  return (
    <ul className="space-y-0">
      {items.map((item, i) => (
        <li key={item.url}>
          <DotLeaderItem href={item.url} title={item.title} date={item.date} />
        </li>
      ))}
    </ul>
  );
}

export default function MediaPage() {
  return (
    <section className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#111] mb-2">
        언론 보도
      </h1>
      <p className="text-[#666] mb-10">
        김포신문 등 언론에서 소개한 김포국악원 기사와 박준열 부원장의 교육 칼럼입니다.
      </p>

      {/* Section 1: General News */}
      <div className="mb-12">
        <h2 className="text-lg font-semibold text-[#111] mb-6 pb-2 border-b border-[#111111]/10">
          김포신문 기사
        </h2>
        <MediaList items={GENERAL_NEWS} />
      </div>

      {/* Divider */}
      <hr className="border-t border-[#111111]/10 my-10" />

      {/* Section 2: Vice Director's Column */}
      <div>
        <h2 className="text-lg font-semibold text-[#111] mb-6 pb-2 border-b border-[#111111]/10">
          박준열 부원장 교육 칼럼
        </h2>
        <MediaList items={COLUMN_ITEMS} />
      </div>

      <p className="mt-12 text-sm text-gray-500">
        <Link href="/intro" className="text-blue-600 hover:underline">
          ← 소개로 돌아가기
        </Link>
      </p>
    </section>
  );
}
