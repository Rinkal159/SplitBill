export default function formatDate(date) {
    const formated_date = new Date(date).toLocaleDateString(
        "en-IN",
        {
            month: "short",
            day: "numeric",
            year: "numeric",
        },
    );

    return formated_date;
}