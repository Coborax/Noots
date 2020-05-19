const express = require("express");
const Mongoose = require("mongoose");
const {
    GraphQLID,
    GraphQLString,
    GraphQLList,
    GraphQLNonNull,
    GraphQLObjectType,
    GraphQLSchema
} = require("graphql");

const graphqlHTTP = require("express-graphql");
const cors = require("cors");

const { importSchema } = require('graphql-import');
const { makeExecutableSchema } = require('graphql-tools');

const bcrypt = require('bcrypt');
const jwt = require("jsonwebtoken");

const isAuth = require("./middleware/isAuth");

Mongoose.connect("MONGOURL");

const UserSchema = Mongoose.Schema({
    username: String,
    password: String
});

const NoteSchema = Mongoose.Schema({
    user: Mongoose.Schema.Types.ObjectID,
    title: String,
    content: String,
});

const UserModel = Mongoose.model("user", UserSchema);
const NoteModel = Mongoose.model("note", NoteSchema);

const typeDefs = importSchema("schema.graphqls");
const resolvers = {
    Query: {
        users() {
            return UserModel.find().exec();
        },
        user(_, { id }) {
            return UserModel.findById(id);
        },
        authUser(_, {}, req) {
            if (req.isAuth) {
                return UserModel.findById(req.userID);
            }
            throw new Error("Not Authenticated!");
        },
        note(_, { id }, req) {
            if (req.isAuth) {
                return NoteModel.findById(id);
            }
            throw Error("Not Authenticated!");
        },
        async login(_, { username, password}) {
            let user = await UserModel.findOne({ username: username });
            if (!user) {
                throw  Error("User does not exist!");
            }
            const isEqual = await bcrypt.compare(password, user.password);
            if (!isEqual) {
                throw  Error("Password is incorrect!");
            }
            const token = jwt.sign({
                userID: user.id,
                username: user.username
            }, "crazysuperkey", {
                expiresIn: "1h"
            });
            return {
                userID: user.id,
                token: token,
                tokenExpiration: 1
            }
        }
    },
    Mutation: {
        createNote(_, { title, content }, req) {
            if (!req.isAuth) {
                throw new Error("Not Authenticated!");
            }
            let note = new NoteModel({
                user: req.userID,
                title: title,
                content: content
            });
            note.save();
            return note;
        },
        async updateNote(_, { id, title, content }, req) {
            if (req.isAuth) {
                let note = await NoteModel.findById(id);

                if (title) {
                    note.title = title;
                }
                if (content) {
                    note.content = content;
                }

                note.save();
                return note;
            }
            throw new Error("Not Authenticated!");
        },
        async createUser(_, { username, password }) {
            let user = await UserModel.findOne({ username: username });
            if (user) {
                throw Error("User already exists!");
            }

            let hash = await bcrypt.hash(password, 10);

            user = new UserModel({
                username: username,
                password: hash
            });

            user.save();
            return user;
        }
    },
    User: {
        notes(user) {
            return NoteModel.find({ user: user.id }).exec();
        }
    },
};

const schema = makeExecutableSchema({ typeDefs, resolvers });

const app = express();
const port = 3000;

app.use(cors());
app.use(isAuth);
app.use(
    "/graphql",
    graphqlHTTP({
        schema: schema,
        graphiql: true
    }),
);

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`))