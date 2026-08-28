import { StudentsOverview } from "@/components/student-management";
import { parseStudentDirectoryParams } from "@/lib/student-directory";
export default async function Page({searchParams}:{searchParams:Promise<{q?:string;status?:string;year?:string;class?:string;section?:string;page?:string;pageSize?:string;created?:string;updated?:string;error?:string}>}){const params=await searchParams;return <StudentsOverview params={params} filters={parseStudentDirectoryParams(params)}/>}
