
import mongoose from "mongoose";
const connectDB =async () =>{
    try{
        const connectionInstance = await mongoose.connect(`${process.env.MONGO_URI}`)
        console.log(`\n Mongo Db connected DB host:${connectionInstance.connection.host}`);

    }
    catch(error){
        console.log('MongoDB Connection error',error);
        process.exit(1);

    }
}
export default connectDB;

