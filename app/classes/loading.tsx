export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-20">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
      <p className="text-gray-500">데이터를 불러오는 중입니다...</p>
    </div>
  );
}
