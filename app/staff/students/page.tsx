import { StudentsOverview } from "@/components/student-management";
export default async function Page({searchParams}:{searchParams:Promise<{q?:string;status?:string;class?:string;section?:string;created?:string;updated?:string;error?:string}>}){return <StudentsOverview params={await searchParams}/>}
