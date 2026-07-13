from fastapi import HTTPException, status, Request, FastAPI
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteException
from fastapi.exceptions import RequestValidationError
from fastapi.exceptions import ValidationException

def handlers(app: FastAPI):
    
    @app.exception_handler(StarletteException)
    def exception_general(request: Request, exception: StarletteException):
        return JSONResponse(
            status_code=exception.status_code,
            content={"error" : exception.detail}
        )
        
        
    @app.exception_handler(RequestValidationError)
    def exception_422(request: Request, exception: RequestValidationError):
        errors= []
        
        for error in exception.errors():
            individual = {
                "field": error.get("loc")[1] if len(error.get("loc")) >= 2 else error.get("loc")[0],
                "error_message": error.get("msg"),
            }
            errors.append(individual)
            
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content={"error" : errors}
        )
        
        
    return app