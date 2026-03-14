// import { prisma } from "@/core/db/prisma";
// import { auth, clerkClient } from "@clerk/nextjs/server";
// import { NextResponse } from "next/server";

// export async function POST() {
//   const { userId } = await auth();

//   if (!userId) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   const clerk = await clerkClient();
//   const clerkUser = await clerk.users.getUser(userId);

//   const email = clerkUser.emailAddresses[0]?.emailAddress;

//   if (!email) {
//     return NextResponse.json({ error: "No email" }, { status: 400 });
//   }

//   let user = await prisma.user.findUnique({
//     where: { id: userId },
//   });

//   if (!user) {
//     user = await prisma.user.create({
//       data: {
//         id: userId,
//         email,
//         name: clerkUser.firstName ?? "",
//       },
//     });
//   }

//   return NextResponse.json(user);
// }
