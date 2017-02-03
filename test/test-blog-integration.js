const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

const should = chai.should();

const { BlogPost } = require('../models');
const { app, runServer, closeServer } = require('../server');
const { TEST_DATABASE_URL } = require('../config');

chai.use(chaiHttp);

// used to put randomish documents in db
// so we have data to work with and assert about.
// we use the Faker library to automatically
// generate placeholder values for author, title, content
// and then we insert that data into mongo
function seedBlogPostData() {
    console.info('seeding blog post data');
    const seedData = [];

    for (let i = 1; i <= 10; i++) {
        seedData.push(generateBlogPostData());
    }
    // this will return a promise
    return BlogPost.insertMany(seedData);
}


// generate an object representing a blog post.
function generateBlogPostData() {
    return {
        author: {
            firstName: faker.name.firstName(),
            lastName: faker.name.lastName()
        },
        title: faker.lorem.sentence(),
        content: faker.lorem.paragraph(),
        created: faker.date.past()
    }
}


// this function deletes the entire database.
// we'll call it in an `afterEach` block 
function tearDownDb() {
    return new Promise((resolve, reject) => {
        console.warn('Deleting database');
        mongoose.connection.dropDatabase()
            .then(result => resolve(result))
            .catch(err => reject(err))
    });
}

describe('Blog App API resource', function() {

    // we need each of these hook functions to return a promise
    // otherwise we'd need to call a `done` callback. `runServer`,
    // `seedBlogPostData` and `tearDownDb` each return a promise,
    // so we return the value returned by these function calls.
    before(function() {
        return runServer(TEST_DATABASE_URL);
    });

    beforeEach(function() {
        return seedBlogPostData();
    });

    afterEach(function() {
        return tearDownDb();
    });

    after(function() {
        return closeServer();
    })



    describe('GET endpoint', function() {

        it('should return all existing blog posts', function() {
            // strategy:
            //    1. get back all blog posts returned by by GET request to `/posts`
            //    2. prove res has right status, data type
            //    3. prove the number of blog posts we got back is equal to number
            //       in db.
            //
            // need to have access to mutate and access `res` across
            // `.then()` calls below, so declare it here so can modify in place
            let res;
            return chai.request(app)

            .get('/posts')
                .then(function(_res) {
                    // so subsequent .then blocks can access resp obj.
                    res = _res;
                    // printObj(res);
                    res.should.have.status(200);
                    // otherwise our db seeding didn't work
                    res.body.should.have.length.of.at.least(1);
                    return BlogPost.count();
                })
                .then(function(count) {
                    res.body.should.have.length.of(count);
                });
        });

        it('should return blog posts with right fields', function() {
            // Strategy: Get back all blog posts, and ensure they have expected keys

            let resPost;
            return chai.request(app)
                .get('/posts')
                .then(function(res) {
                    res.should.have.status(200);
                    res.should.be.json;
                    res.body.should.be.a('array');
                    res.body.should.have.length.of.at.least(1);

                    res.body.forEach(function(blogPost) {
                        blogPost.should.be.a('object');
                        blogPost.should.include.keys(
                            'id', 'author', 'content', 'title', 'created');
                    });
                    resPost = res.body[0];
                    return BlogPost.findById(resPost.id);
                })
                .then(function(blogPost) {
                	printObj(blogPost);
                	// console.log(blogPost);
                    resPost.id.should.equal(blogPost._id.toString());
                    resPost.author.should.equal(blogPost.author.firstName 
                    	+ " " + blogPost.author.lastName);
                    resPost.content.should.equal(blogPost.content);
                    resPost.title.should.equal(blogPost.title);
                    console.log("respost= " + resPost.created
                    	+ "\nblogpost= " + blogPost.created);
                    Date(resPost.created).should.equal(Date(blogPost.created));
                });
        });
    });

    function printObj(res) {
        console.log("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
        console.log(res);
        let objStr = "";
    };
});
