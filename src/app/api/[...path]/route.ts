import { problem, route } from "@/app/api/_lib";

/** Any /api path that does not exist answers in JSON, like the rest of the API, instead of an HTML page. */
const notFound = route(async (request) => problem(404, `No API endpoint at ${new URL(request.url).pathname}.`, { endpoints: "/api" }));

export { notFound as GET, notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE };
