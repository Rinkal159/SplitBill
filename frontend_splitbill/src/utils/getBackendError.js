const getBackendError = (error) => {
    const data = error.response?.data;
    const message =
        data?.detail ??
        data?.error ??
        data?.message ??
        "Could not load the data. Please try again.";

    return {
        type: error.response?.status,
        error: Array.isArray(message) ? message : [message],
    };
}

export default getBackendError;